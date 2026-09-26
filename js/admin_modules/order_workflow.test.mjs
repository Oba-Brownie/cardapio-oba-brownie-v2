import test from 'node:test';
import assert from 'node:assert/strict';
import { cancelOrderAndReleaseStock, confirmOrderPreparation, transitionOrderStatus, getOrderBoardStage } from './order_workflow.js';

function createSupabaseRecorder(response = { data: { ok: true }, error: null }) {
    const calls = [];
    return {
        calls,
        client: {
            rpc: async (...args) => {
                calls.push(args);
                return response;
            }
        }
    };
}

test('preparation confirmation calls the stock-authorized RPC with the order id', async () => {
    const recorder = createSupabaseRecorder();
    await confirmOrderPreparation(recorder.client, 120);

    assert.deepEqual(recorder.calls, [[
        'confirmar_pedido_preparacao',
        { p_pedido_id: '120', p_confirmar_legado: false }
    ]]);
});

test('delivery and completion transitions use the status RPC', async () => {
    const recorder = createSupabaseRecorder();
    await transitionOrderStatus(recorder.client, 120, 'Em Entrega');
    await transitionOrderStatus(recorder.client, 120, 'Concluido');

    assert.deepEqual(recorder.calls.map(([name, args]) => [name, args.p_novo_status]), [
        ['mudar_status_pedido', 'Em Entrega'],
        ['mudar_status_pedido', 'Concluido']
    ]);
});

test('legacy confirmation is passed explicitly to the stock RPC', async () => {
    const recorder = createSupabaseRecorder();
    await confirmOrderPreparation(recorder.client, 120, true);

    assert.deepEqual(recorder.calls[0], [
        'confirmar_pedido_preparacao',
        { p_pedido_id: '120', p_confirmar_legado: true }
    ]);
});

test('cancelling an order calls the atomic reservation release RPC', async () => {
    const recorder = createSupabaseRecorder();
    await cancelOrderAndReleaseStock(recorder.client, 120);

    assert.deepEqual(recorder.calls, [[
        'cancelar_pedido_e_liberar_estoque',
        { p_pedido_id: '120' }
    ]]);
});

test('invalid status changes are rejected before reaching Supabase', async () => {
    const recorder = createSupabaseRecorder();
    const result = await transitionOrderStatus(recorder.client, 120, 'Em Preparação');

    assert.ok(result.error);
    assert.equal(recorder.calls.length, 0);
});

test('preparation orders appear in the active kanban column', () => {
    assert.equal(getOrderBoardStage('Em Preparação'), 'active');
    assert.equal(getOrderBoardStage('Em Entrega'), 'active');
    assert.equal(getOrderBoardStage('Novo'), 'new');
    assert.equal(getOrderBoardStage('Concluido'), 'done');
});
