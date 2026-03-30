import { DADOS_LOJA } from '../config/constants.js';

// === VALIDAÇÕES E FORMATAÇÕES ===
export function formatCurrency(value) {
    return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

export function verificarStatusLoja(lojaForcadaFechada) {
    if (lojaForcadaFechada) return false;

    const agora = new Date();
    const diaAtual = agora.getDay(); 
    const horaDecimal = agora.getHours() + (agora.getMinutes() / 60);

    const hojeFunciona = DADOS_LOJA.diasFuncionamento.includes(diaAtual);
    const dentroDoHorario = horaDecimal >= DADOS_LOJA.horarioAbertura && horaDecimal < DADOS_LOJA.horarioFechamento;

    return hojeFunciona && dentroDoHorario;
}

// === INTEGRAÇÕES DE SISTEMA (Navegador) ===
export async function copyToClipboard(text) {
    if (!text) return false;

    if (navigator.clipboard && window.isSecureContext) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            console.warn('Falha ao copiar com API Clipboard:', err);
        }
    }

    try {
        const textArea = document.createElement("textarea");
        textArea.value = text;
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
        console.error('Falha ao copiar:', err);
        return false;
    }
}

export function getSaudacao() {
    const hora = new Date().getHours();
    if (hora < 12) return "Bom dia";
    if (hora < 18) return "Boa tarde";
    return "Boa noite";
}