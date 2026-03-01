/* ================================================= */
/* ARQUIVO: js/modules/utils.js                      */
/* Funções utilitárias gerais (Helpers)              */
/* ================================================= */

import { DADOS_LOJA } from '../config/constants.js';

/**
 * Formata um número para o padrão de moeda brasileiro (R$ 0,00)
 * @param {number} value - O valor a ser formatado
 * @returns {string} String formatada (ex: "R$ 10,50")
 */
export function formatCurrency(value) {
    return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

/**
 * Verifica se a loja está aberta com base no horário local e na flag de fechamento forçado
 * @param {boolean} lojaForcadaFechada - Flag vinda da API (Contentful)
 * @returns {boolean} True se aberta, False se fechada
 */
export function verificarStatusLoja(lojaForcadaFechada) {
    // 1. Se estiver forçada a fechar pelo painel, retorna false imediatamente
    if (lojaForcadaFechada) return false;

    // 2. Obtém hora atual do dispositivo do cliente
    const agora = new Date();
    const diaAtual = agora.getDay(); // 0 = Domingo, 1 = Segunda...
    
    // 3. Calcula hora decimal (ex: 14:30 = 14.5)
    const horaDecimal = agora.getHours() + (agora.getMinutes() / 60);

    // 4. Valida Dias de Funcionamento
    const hojeFunciona = DADOS_LOJA.diasFuncionamento.includes(diaAtual);
    
    // 5. Valida Horário (Abertura <= Agora < Fechamento)
    const dentroDoHorario = horaDecimal >= DADOS_LOJA.horarioAbertura && horaDecimal < DADOS_LOJA.horarioFechamento;

    return hojeFunciona && dentroDoHorario;
}

/**
 * Copia um texto para a área de transferência (Clipboard)
 * Tenta usar a API moderna, com fallback para o método antigo se falhar
 * @param {string} text - Texto a ser copiado
 * @returns {Promise<boolean>} True se sucesso, False se erro
 */
export async function copyToClipboard(text) {
    if (!text) return false;

    // Tenta API Moderna (HTTPS / Localhost)
    if (navigator.clipboard && window.isSecureContext) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            console.warn('Falha ao copiar com API Clipboard:', err);
            // Continua para o fallback abaixo
        }
    }

    // Fallback (Método antigo: textarea temporário)
    try {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        
        // Garante que o textarea não seja visível na tela
        textArea.style.position = "absolute";
        textArea.style.left = "-9999px";
        textArea.style.top = "0";
        
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        return successful;
    } catch (err) {
        console.error('Falha ao copiar com método fallback:', err);
        return false;
    }
}

/**
 * Retorna uma saudação baseada no horário (Bom dia, Boa tarde, Boa noite)
 * Útil para mensagens de WhatsApp
 */
export function getSaudacao() {
    const hora = new Date().getHours();
    if (hora < 12) return "Bom dia";
    if (hora < 18) return "Boa tarde";
    return "Boa noite";
}