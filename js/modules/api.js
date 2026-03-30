import { supabase } from '../config/supabase-config.js';

// === CONFIGURAÇÕES DA LOJA ===
export async function fetchConfiguracaoLoja() {
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

// === BUSCA DE PRODUTOS (COM CACHE) ===
export async function fetchProducts() {
    // 1. Tenta pegar do cache primeiro
    const cache = sessionStorage.getItem('oba_produtos_cache');
    const cacheTime = sessionStorage.getItem('oba_produtos_time');
    
    if (cache && cacheTime) {
        const diffMinutes = (Date.now() - parseInt(cacheTime)) / 60000;
        // Usa o cache visual se tiver menos de 15 minutos
        if (diffMinutes < 15) {
            return JSON.parse(cache);
        }
    }

    // 2. Se não tem cache ou expirou, busca no banco
    try {
        const { data, error } = await supabase
            .from('produtos')
            .select('id, nome, descricao, preco, preco_original, imagem, categoria, estoque, destaque, ordem')
            .eq('ativo', true)
            .order('ordem', { ascending: true });

        if (error) throw error;

        const produtosFormatados = data.map(item => ({
            id: item.id,
            name: item.nome,
            description: item.descricao || '',
            price: item.preco,
            originalPrice: item.preco_original || null, 
            image: item.imagem || 'https://placehold.co/400x400?text=Sem+Foto',
            categoria: item.categoria || 'Outros',
            estoque: item.estoque,
            destaque: item.destaque || false,
            ordem: item.ordem || 999
        }));

        // 3. Salva no cache para não gastar banda nas próximas atualizações de página
        sessionStorage.setItem('oba_produtos_cache', JSON.stringify(produtosFormatados));
        sessionStorage.setItem('oba_produtos_time', Date.now().toString());

        return produtosFormatados;

    } catch (error) {
        console.error("Erro ao buscar produtos:", error);
        return [];
    }
}