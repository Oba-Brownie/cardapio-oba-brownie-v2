import { supabase } from '../config/supabase-config.js';
import { LOCAL_TEST_MODE, getMockConfigLoja, getMockProductsPublic } from './local_test_mode.js';

// === CONFIGURAÇÕES DA LOJA ===
export async function fetchConfiguracaoLoja() {
    if (LOCAL_TEST_MODE) {
        return getMockConfigLoja();
    }

    try {
        const { data, error } = await supabase
            .from('config_loja')
            .select('loja_aberta, mensagem_fechado, categorias_ordem, chave_pix, qr_code_pix')
            .limit(1)
            .single();

        // O código PGRST116 significa "Nenhuma linha encontrada" (tabela ainda vazia).
        if (error && error.code !== 'PGRST116') {
            throw error;
        }

        if (!data) {
            return {
                lojaAbertaManual: true,
                mensagemFechado: "⚠️ A loja está fechada no momento.",
                categoriasOrdem: ["Promoções", "Brownies", "Bolos", "Doces"],
                chavePix: ""
            };
        }

        return {
            lojaAbertaManual: data.loja_aberta,
            mensagemFechado: data.mensagem_fechado,
            categoriasOrdem: data.categorias_ordem || [],
            chavePix: data.chave_pix,
            qrCodePix: data.qr_code_pix 
        };

    } catch (error) {
        console.error("Erro config loja:", error);
        return { 
            lojaAbertaManual: true,
            mensagemFechado: "⚠️ A loja está fechada no momento.",
            categoriasOrdem: [],
            chavePix: "",
            qrCodePix: ""
        }; 
    }
}

const PRODUCTS_CACHE_TTL_MINUTES = 2;

function getCachedProducts() {
    const cache = sessionStorage.getItem('oba_produtos_cache');
    if (!cache) return null;

    try {
        return JSON.parse(cache);
    } catch {
        sessionStorage.removeItem('oba_produtos_cache');
        sessionStorage.removeItem('oba_produtos_time');
        return null;
    }
}

function isProductsCacheFresh() {
    const cacheTime = sessionStorage.getItem('oba_produtos_time');
    if (!cacheTime) return false;

    const diffMinutes = (Date.now() - parseInt(cacheTime, 10)) / 60000;
    return diffMinutes < PRODUCTS_CACHE_TTL_MINUTES;
}

function findPromotionForProduct(product, promotions) {
    const matching = promotions.filter(promotion => {
        if (promotion.target_tipo === 'loja') return true;
        if (promotion.target_tipo === 'categoria') return promotion.target_valor === product.categoria;
        if (promotion.target_tipo === 'produto') return String(promotion.target_valor) === String(product.id);
        return false;
    });

    const priority = { produto: 3, categoria: 2, loja: 1 };
    matching.sort((a, b) => (priority[b.target_tipo] || 0) - (priority[a.target_tipo] || 0)
        || new Date(b.criado_em || 0) - new Date(a.criado_em || 0));
    return matching[0] || null;
}

// === BUSCA DE PRODUTOS (COM CACHE DE FALLBACK) ===
export async function fetchProducts(options = {}) {
    if (LOCAL_TEST_MODE) {
        return getMockProductsPublic();
    }

    const forceRefresh = options.forceRefresh === true;
    const cachedProducts = getCachedProducts();

    if (!forceRefresh && cachedProducts && isProductsCacheFresh()) {
        return cachedProducts;
    }

    try {
        const { data, error } = await supabase
            .from('produtos')
            .select('id, nome, descricao, preco, preco_original, imagem, categoria, estoque, estoque_reservado, destaque, ordem')
            .eq('ativo', true)
            .order('ordem', { ascending: true });

        if (error) throw error;

        let promotions = [];
        const { data: activePromotions, error: promotionError } = await supabase
            .from('promocoes')
            .select('id, target_tipo, target_valor, desconto_percentual, valor_minimo, criado_em')
            .eq('ativo', true)
            .order('criado_em', { ascending: false });
        if (promotionError) {
            console.warn('Não foi possível carregar promoções; o cardápio seguirá sem elas.', promotionError);
        } else {
            promotions = activePromotions || [];
        }

        const produtosFormatados = data.map(item => {
            const category = item.categoria || 'Outros';
            const promotion = findPromotionForProduct({ id: item.id, categoria: category }, promotions);
            const price = Number(item.preco_original) > Number(item.preco) ? Number(item.preco_original) : Number(item.preco);
            return {
                id: item.id,
                name: item.nome,
                description: item.descricao || '',
                price,
                originalPrice: promotion ? null : (item.preco_original || null),
                promotion: promotion ? {
                    id: promotion.id,
                    desconto_percentual: Number(promotion.desconto_percentual),
                    valor_minimo: Number(promotion.valor_minimo) || 0
                } : null,
                image: item.imagem || 'https://placehold.co/400x400?text=Sem+Foto',
                categoria: category,
                estoque: Math.max(0, Number(item.estoque || 0) - Number(item.estoque_reservado || 0)),
                destaque: item.destaque || false,
                ordem: item.ordem || 999
            };
        });

        // 3. Salva no cache para não gastar banda nas próximas atualizações de página
        sessionStorage.setItem('oba_produtos_cache', JSON.stringify(produtosFormatados));
        sessionStorage.setItem('oba_produtos_time', Date.now().toString());

        return produtosFormatados;

    } catch (error) {
        console.error("Erro ao buscar produtos:", error);
        return cachedProducts || [];
    }
}
