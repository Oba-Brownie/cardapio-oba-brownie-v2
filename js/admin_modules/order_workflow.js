const ALLOWED_ADMIN_TRANSITIONS = new Set(['Em Entrega', 'Concluido']);

export function confirmOrderPreparation(supabase, orderId, confirmLegacyStock = false) {
    return supabase.rpc('confirmar_pedido_preparacao', {
        p_pedido_id: String(orderId),
        p_confirmar_legado: Boolean(confirmLegacyStock)
    });
}

export function transitionOrderStatus(supabase, orderId, newStatus) {
    if (!ALLOWED_ADMIN_TRANSITIONS.has(newStatus)) {
        return Promise.resolve({
            data: null,
            error: { code: 'INVALID_STATUS', message: 'Transição de status não permitida.' }
        });
    }

    return supabase.rpc('mudar_status_pedido', {
        p_pedido_id: String(orderId),
        p_novo_status: newStatus
    });
}

export function cancelOrderAndReleaseStock(supabase, orderId) {
    return supabase.rpc('cancelar_pedido_e_liberar_estoque', {
        p_pedido_id: String(orderId)
    });
}

export function getOrderBoardStage(status) {
    if (status === 'Novo') return 'new';
    if (status === 'Em Preparação' || status === 'Em Entrega' || status === 'Visto') return 'active';
    if (status === 'Concluido') return 'done';
    return null;
}
