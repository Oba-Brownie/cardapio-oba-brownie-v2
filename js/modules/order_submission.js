const CHECKOUT_REQUEST_KEY = 'oba_checkout_request_id';

export function getOrCreateCheckoutRequestId(storage = globalThis.localStorage, createId = () => globalThis.crypto.randomUUID()) {
    let requestId = storage.getItem(CHECKOUT_REQUEST_KEY);
    if (!requestId) {
        requestId = createId();
        storage.setItem(CHECKOUT_REQUEST_KEY, requestId);
    }
    return requestId;
}

export function clearCheckoutRequestId(storage = globalThis.localStorage) {
    storage.removeItem(CHECKOUT_REQUEST_KEY);
}

export function createOrderWithStockReservation(supabase, pedido, requestId, turnstileToken) {
    return supabase.functions.invoke('criar-pedido', {
        body: {
            pedido,
            request_id: requestId,
            turnstile_token: turnstileToken
        }
    });
}
