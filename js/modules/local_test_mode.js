export const LOCAL_TEST_MODE = false;

export function assertNotLocalMutation() {}

export function createBlockedSupabaseClient() {
    throw new Error('Modo local de teste desativado nesta versao.');
}

export function getMockConfigLoja() {
    return null;
}

export function getMockProductsPublic() {
    return [];
}

export function getMockProductsAdmin() {
    return [];
}

export function getMockPedidos() {
    return [];
}

export function getMockCupons() {
    return [];
}

export function findMockPedido() {
    return null;
}

export function findMockCupom() {
    return null;
}

export function showLocalMutationBlocked(action = 'Operacao') {
    alert(`${action} indisponivel nesta versao.`);
}
