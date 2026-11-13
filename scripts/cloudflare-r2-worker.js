/**
 * Cloudflare Worker para Upload Seguro no Bucket R2 ('oba-brownie-fotos')
 *
 * Como usar no painel da Cloudflare (opcional, para salvar novas fotos direto no R2):
 * 1. Acesse Workers & Pages -> Create -> Create Worker (ex: "oba-r2-upload").
 * 2. Em Settings -> Bindings -> Add -> R2 Bucket:
 *    - Variable name: BUCKET
 *    - R2 bucket: oba-brownie-fotos
 * 3. Cole este código no editor do Worker e faça Deploy.
 * 4. Copie a URL gerada do Worker (ex: https://oba-r2-upload.seu-subdominio.workers.dev)
 *    e cole em `uploadWorkerUrl` no arquivo `js/config/r2-config.js`.
 */

const ALLOWED_ORIGINS = [
    'https://oba-brownie.github.io',
    'http://localhost:8080',
    'http://127.0.0.1:8080',
    'http://localhost:5500',
    'http://127.0.0.1:5500'
];

const SUPABASE_USER_ENDPOINT = 'https://diyskqeunfunotqfmncq.supabase.co/auth/v1/user';
const SUPABASE_PUBLIC_KEY = 'sb_publishable_b61ljD76N2EDivYWew0IJg_6hbpAf2L';
const R2_PUBLIC_BASE = 'https://pub-444a12cc8dff469ca364cebc0a29771b.r2.dev';
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

function getCorsHeaders(origin) {
    const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
    return {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-File-Name'
    };
}

export default {
    async fetch(request, env) {
        const origin = request.headers.get('Origin') || '';
        const corsHeaders = getCorsHeaders(origin);

        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: corsHeaders });
        }

        if (request.method !== 'POST') {
            return new Response(JSON.stringify({ error: 'Método não permitido' }), {
                status: 405,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const authHeader = request.headers.get('Authorization') || '';
        if (!authHeader.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ error: 'Token de autenticação ausente' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Valida o JWT diretamente no Supabase Auth
        const authCheck = await fetch(SUPABASE_USER_ENDPOINT, {
            headers: {
                'apikey': SUPABASE_PUBLIC_KEY,
                'Authorization': authHeader
            }
        });

        if (!authCheck.ok) {
            return new Response(JSON.stringify({ error: 'Sessão administrativa inválida ou expirada' }), {
                status: 403,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const contentType = request.headers.get('Content-Type') || '';
        if (!contentType.startsWith('image/webp') && !contentType.startsWith('image/png') && !contentType.startsWith('image/jpeg')) {
            return new Response(JSON.stringify({ error: 'Formato de imagem inválido' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const rawName = (request.headers.get('X-File-Name') || `produtos/upload-${Date.now()}.webp`)
            .replace(/^\/+/, '')
            .replace(/[^a-zA-Z0-9/_.-]/g, '-');

        const key = rawName.startsWith('produtos/') ? rawName : `produtos/${rawName}`;
        const body = await request.arrayBuffer();

        if (!body.byteLength || body.byteLength > MAX_SIZE_BYTES) {
            return new Response(JSON.stringify({ error: 'Imagem vazia ou acima do limite de 5MB' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        await env.BUCKET.put(key, body, {
            httpMetadata: { contentType }
        });

        return new Response(JSON.stringify({
            url: `${R2_PUBLIC_BASE}/${key}`,
            key
        }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
};
