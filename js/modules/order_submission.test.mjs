import test from 'node:test';
import assert from 'node:assert/strict';
import {
    clearCheckoutRequestId,
    createOrderWithStockReservation,
    getOrCreateCheckoutRequestId,
    hasRequiredPickupObservation,
    roundCurrency
} from './order_submission.js';

function createStorage() {
    const values = new Map();
    return {
        getItem: key => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
        removeItem: key => values.delete(key)
    };
}

test('checkout request id is stable across retries and cleared after success', () => {
    const storage = createStorage();
    let calls = 0;
    const createId = () => `request-${++calls}`;

    assert.equal(getOrCreateCheckoutRequestId(storage, createId), 'request-1');
    assert.equal(getOrCreateCheckoutRequestId(storage, createId), 'request-1');
    assert.equal(calls, 1);

    clearCheckoutRequestId(storage);
    assert.equal(getOrCreateCheckoutRequestId(storage, createId), 'request-2');
});

test('monetary values are normalized to cents before sending them to the database', () => {
    assert.equal(roundCurrency(0.1 + 0.2), 0.3);
    assert.equal(roundCurrency(8.6 + 0.2), 8.8);
    assert.equal(roundCurrency(12.345), 12.35);
});

test('pickup requires an observation while delivery keeps it optional', () => {
    assert.equal(hasRequiredPickupObservation('pickup', ''), false);
    assert.equal(hasRequiredPickupObservation('pickup', '   '), false);
    assert.equal(hasRequiredPickupObservation('pickup', 'Vou buscar às 15h'), true);
    assert.equal(hasRequiredPickupObservation('delivery', ''), true);
});

test('checkout sends order, idempotency key and challenge token through the server function', async () => {
    const calls = [];
    const supabase = { functions: { invoke: async (...args) => { calls.push(args); return { data: { ok: true }, error: null }; } } };
    const order = { cliente_nome: 'Cliente', itens: [{ id: '9', quantity: 1 }], total: 12 };

    await createOrderWithStockReservation(supabase, order, 'request-123', 'turnstile-token');

    assert.deepEqual(calls, [[
        'criar-pedido',
        { body: { pedido: order, request_id: 'request-123', turnstile_token: 'turnstile-token' } }
    ]]);
});
