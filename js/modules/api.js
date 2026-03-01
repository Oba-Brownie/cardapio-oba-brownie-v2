/* ARQUIVO: js/modules/api.js */
import { supabase } from '../config/supabase-config.js';

/**
 * Busca as configurações da loja (Status, Mensagens, Pix, Ordem de Categorias)
 */
export async function fetchConfiguracaoLoja() {
    try {
        const { data, error } = await supabase
            .from('config_loja')
            .select('*') // Pega tudo (mensagem, ordem, pix, status)
            .limit(1)
            .single();

        // Código PGRST116 significa "Nenhuma linha encontrada". 
        // Não é um erro crítico, apenas significa que precisamos criar a config inicial.
        if (error && error.code !== 'PGRST116') {
            throw error;
        }

        // Se não tiver dados (tabela vazia), retorna o padrão
        if (!data) {
            return {
                lojaAbertaManual: true,
                mensagemFechado: "⚠️ A loja está fechada no momento.",
                categoriasOrdem: ["Promoções", "Brownies", "Bolos", "Doces"], // Padrão inicial
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
        // Fallback de segurança para o site não travar
        return { 
            lojaAbertaManual: true,
            mensagemFechado: "⚠️ A loja está fechada no momento.",
            categoriasOrdem: [],
            chavePix: "",
            qrCodePix: ""
        }; 
    }
}

/**
 * Busca a lista de produtos do Supabase
 */
export async function fetchProducts() {
    console.log("--- BUSCANDO DO SUPABASE ---");
    
    try {
        const { data, error } = await supabase
            .from('produtos')
            .select('*')
            .eq('ativo', true)
            .order('ordem', { ascending: true }); // Respeita a ordem numérica dos produtos

        if (error) throw error;

        return data.map(item => ({
            id: item.id,
            name: item.nome,
            description: item.descricao || '',
            price: item.preco,
            // Se você tiver uma coluna 'preco_original' no banco futuramente, altere aqui:
            originalPrice: item.preco_original || null, 
            image: item.imagem || 'https://placehold.co/400x400?text=Sem+Foto',
            categoria: item.categoria || 'Outros',
            estoque: item.estoque,
            destaque: item.destaque || false,
            ordem: item.ordem || 999
        }));

    } catch (error) {
        console.error("Erro ao buscar produtos:", error);
        return [];
    }
}
