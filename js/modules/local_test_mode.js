const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1'];
const isLocalEnvironment = window.location.protocol === 'file:'
    || LOCAL_HOSTS.includes(window.location.hostname);

export const LOCAL_TEST_MODE = isLocalEnvironment
    && new URLSearchParams(window.location.search).get('mock') === 'true';

const mockProducts = [
    {
        id: 'mock-1',
        name: 'Bomba Oreo',
        nome: 'Bomba Oreo',
        description: 'Bolinho fofinho de cacau black com recheio de brigadeiro, envolto no chocolate branco oreo',
        descricao: 'Bolinho fofinho de cacau black com recheio de brigadeiro, envolto no chocolate branco oreo',
        price: 6.99,
        preco: 6.99,
        originalPrice: 9,
        preco_original: 9,
        image: 'https://i.ibb.co/M5c9mj87/brownie-1778073562842.png',
        imagem: 'https://i.ibb.co/M5c9mj87/brownie-1778073562842.png',
        categoria: 'Promoções',
        estoque: 20,
        destaque: true,
        ativo: true,
        ordem: 1
    },
    {
        id: 'mock-2',
        name: 'Coxinha de morango, ninho e nutella',
        nome: 'Coxinha de morango, ninho e nutella',
        description: 'Morango com brigadeiro de leite ninho e Nutella',
        descricao: 'Morango com brigadeiro de leite ninho e Nutella',
        price: 8.99,
        preco: 8.99,
        originalPrice: 10,
        preco_original: 10,
        image: 'https://i.ibb.co/YTWKMN9p/brownie.webp',
        imagem: 'https://i.ibb.co/YTWKMN9p/brownie.webp',
        categoria: 'Promoções',
        estoque: 8,
        destaque: true,
        ativo: true,
        ordem: 2
    },
    {
        id: 'mock-3',
        name: 'Brownie ninho com Nutella',
        nome: 'Brownie ninho com Nutella',
        description: 'Brownie macio com creme de ninho e Nutella cremosa',
        descricao: 'Brownie macio com creme de ninho e Nutella cremosa',
        price: 10,
        preco: 10,
        originalPrice: null,
        preco_original: null,
        image: 'https://i.ibb.co/1WQnp0y/brownie-1775274033397.webp',
        imagem: 'https://i.ibb.co/1WQnp0y/brownie-1775274033397.webp',
        categoria: 'Brownies',
        estoque: 12,
        destaque: false,
        ativo: true,
        ordem: 1
    },
    {
        id: 'mock-4',
        name: 'Bolo gelado choconinho',
        nome: 'Bolo gelado choconinho',
        description: 'Fatia de bolo gelado molhadinho com brigadeiro tradicional e mousse de leite ninho',
        descricao: 'Fatia de bolo gelado molhadinho com brigadeiro tradicional e mousse de leite ninho',
        price: 8,
        preco: 8,
        originalPrice: null,
        preco_original: null,
        image: 'https://i.ibb.co/TqD7dnHn/brownie.webp',
        imagem: 'https://i.ibb.co/TqD7dnHn/brownie.webp',
        categoria: 'Bolos',
        estoque: 4,
        destaque: false,
        ativo: true,
        ordem: 1
    }
];

export function assertNotLocalMutation(action = 'operacao') {
    if (!LOCAL_TEST_MODE) return;
    throw new Error(`Modo local ativo: ${action} bloqueada.`);
}

export function createBlockedSupabaseClient() {
    const block = () => {
        throw new Error('LOCAL_TEST_MODE ativo: chamada Supabase bloqueada.');
    };

    return {
        from: block,
        channel: block,
        storage: { from: block },
        auth: {
            getSession: async () => ({ data: { session: null }, error: null }),
            signInWithPassword: async () => ({ data: null, error: new Error('LOCAL_TEST_MODE ativo') }),
            signOut: async () => ({ error: null })
        }
    };
}

export function getMockConfigLoja() {
    return {
        lojaAbertaManual: true,
        mensagemFechado: 'Modo local de teste ativo.',
        categoriasOrdem: ['Promoções', 'Brownies', 'Bolos', 'Doces', 'Salgados'],
        chavePix: 'pix-local@example.test',
        qrCodePix: ''
    };
}

export function getMockProductsPublic() {
    return mockProducts.map(product => ({
        id: product.id,
        name: product.name,
        description: product.description,
        price: product.price,
        originalPrice: product.originalPrice,
        image: product.image,
        categoria: product.categoria,
        estoque: product.estoque,
        destaque: product.destaque,
        ordem: product.ordem
    }));
}

export function getMockProductsAdmin() {
    return mockProducts.map(product => ({ ...product }));
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
    alert(`${action} bloqueada no modo local. Nenhum dado foi enviado.`);
}
