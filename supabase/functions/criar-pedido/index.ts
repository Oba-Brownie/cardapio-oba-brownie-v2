const ALLOWED_ORIGIN = 'https://oba-brownie.github.io';
const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const MAX_BODY_BYTES = 20_000;

function jsonResponse(body: unknown, status: number, origin: string) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            'content-type': 'application/json; charset=utf-8',
            'access-control-allow-origin': origin,
            'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
            'access-control-allow-methods': 'POST, OPTIONS',
            'vary': 'Origin',
            'cache-control': 'no-store'
        }
    });
}

Deno.serve(async request => {
    const origin = request.headers.get('origin') || '';
    if (origin !== ALLOWED_ORIGIN) {
        return new Response('Forbidden', { status: 403, headers: { 'vary': 'Origin' } });
    }

    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                'access-control-allow-origin': origin,
                'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
                'access-control-allow-methods': 'POST, OPTIONS',
                'access-control-max-age': '86400',
                'vary': 'Origin'
            }
        });
    }

    if (request.method !== 'POST') return jsonResponse({ ok: false, code: 'METHOD_NOT_ALLOWED' }, 405, origin);
    const contentLength = Number(request.headers.get('content-length') || 0);
    if (contentLength > MAX_BODY_BYTES) return jsonResponse({ ok: false, code: 'REQUEST_TOO_LARGE' }, 413, origin);

    let body: { pedido?: unknown; request_id?: unknown; turnstile_token?: unknown };
    try {
        const rawBody = await request.text();
        if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
            return jsonResponse({ ok: false, code: 'REQUEST_TOO_LARGE' }, 413, origin);
        }
        body = JSON.parse(rawBody);
    } catch {
        return jsonResponse({ ok: false, code: 'INVALID_REQUEST' }, 400, origin);
    }

    const requestId = typeof body.request_id === 'string' ? body.request_id : '';
    const token = typeof body.turnstile_token === 'string' ? body.turnstile_token : '';
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)
        || !body.pedido || typeof body.pedido !== 'object'
        || token.length < 1 || token.length > 2048) {
        return jsonResponse({ ok: false, code: 'INVALID_REQUEST' }, 400, origin);
    }

    const turnstileSecret = Deno.env.get('TURNSTILE_SECRET_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')?.replace(/\/+$/, '');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!turnstileSecret || !supabaseUrl || !serviceRoleKey) {
        return jsonResponse({ ok: false, code: 'CHECKOUT_NOT_CONFIGURED' }, 503, origin);
    }

    let verification: { success?: boolean; hostname?: string; action?: string };
    try {
        const verifyResponse = await fetch(TURNSTILE_VERIFY_URL, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ secret: turnstileSecret, response: token }),
            signal: AbortSignal.timeout(6000)
        });
        if (!verifyResponse.ok) return jsonResponse({ ok: false, code: 'SECURITY_CHECK_UNAVAILABLE' }, 503, origin);
        verification = await verifyResponse.json();
    } catch {
        return jsonResponse({ ok: false, code: 'SECURITY_CHECK_UNAVAILABLE' }, 503, origin);
    }

    if (verification.success !== true
        || verification.hostname !== 'oba-brownie.github.io'
        || verification.action !== 'checkout') {
        return jsonResponse({ ok: false, code: 'SECURITY_CHECK_FAILED' }, 200, origin);
    }

    try {
        const rpcResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/criar_pedido_com_reserva`, {
            method: 'POST',
            headers: {
                apikey: serviceRoleKey,
                authorization: `Bearer ${serviceRoleKey}`,
                'content-type': 'application/json',
                'content-profile': 'public',
                'accept-profile': 'public'
            },
            body: JSON.stringify({ p_pedido: body.pedido, p_request_id: requestId }),
            signal: AbortSignal.timeout(8000)
        });

        const result = await rpcResponse.json().catch(() => null);
        if (rpcResponse.ok && result?.ok === true) {
            return jsonResponse({ ok: true, pedido_id: result.pedido_id, repetido: result.repetido === true }, 200, origin);
        }

        const databaseCode = typeof result?.code === 'string' ? result.code : '';
        if (databaseCode === 'P0001') return jsonResponse({ ok: false, code: 'STOCK_UNAVAILABLE' }, 200, origin);
        if (databaseCode === '22023') return jsonResponse({ ok: false, code: 'INVALID_ORDER' }, 200, origin);
        if (databaseCode === '23505') return jsonResponse({ ok: false, code: 'IDEMPOTENCY_CONFLICT' }, 200, origin);
        if (databaseCode === 'P0002') return jsonResponse({ ok: false, code: 'ORDER_NOT_AVAILABLE' }, 200, origin);

        // Registre somente metadados; não escreva telefone, endereço, pedido ou token nos logs.
        console.error('Checkout RPC failed', { status: rpcResponse.status, code: databaseCode || 'unknown' });
        return jsonResponse({ ok: false, code: 'CHECKOUT_TEMPORARILY_UNAVAILABLE' }, 503, origin);
    } catch {
        return jsonResponse({ ok: false, code: 'CHECKOUT_TEMPORARILY_UNAVAILABLE' }, 503, origin);
    }
});
