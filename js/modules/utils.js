import { DADOS_LOJA } from '../config/constants.js';

// === VALIDAÇÕES, FORMATAÇÕES E SAÍDAS SEGURAS ===
export function formatCurrency(value) {
    return `R$ ${safeNumber(value).toFixed(2).replace('.', ',')}`;
}

export function escapeHTML(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/`/g, '&#96;');
}

export function escapeAttribute(value) {
    return escapeHTML(value);
}

export function inlineJSString(value) {
    return escapeAttribute(JSON.stringify(String(value ?? '')));
}

export function safeNumber(value, fallback = 0) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : fallback;
}

export function formatCurrencyBR(value) {
    return safeNumber(value).toFixed(2).replace('.', ',');
}

export const DEFAULT_IMAGE_FALLBACK = 'images/placeholder-brownie.svg';

// Mapeamento de resgate para URLs do Cloudinary desativado (hhoqdvcp)
// apontando para imagens correspondentes recuperadas hospedadas no Cloudflare R2 oficial
const R2_BASE = 'https://pub-444a12cc8dff469ca364cebc0a29771b.r2.dev';

export const RECOVERED_IMAGE_MAP = {
    // Bordinhas de brownie
    'produtos/doces/bordinhas-de-brownie': `${R2_BASE}/produtos/doces/bordinhas-de-brownie.webp`,
    // Pão de mel doce de leite
    'produtos/doces/pao-de-mel-doce-de-leite': `${R2_BASE}/produtos/doces/pao-de-mel-doce-de-leite.png`,
    // Pão de mel brigadeiro
    'produtos/doces/pao-de-mel-de-brigadeiro': `${R2_BASE}/produtos/doces/pao-de-mel-de-brigadeiro.png`,
    // Brotinho Frango
    'produtos/salgados/brotinho-frango': `${R2_BASE}/produtos/salgados/brotinho-frango.webp`,
    // Brownie Tradicional
    'produtos/brownies/brownie-tradicional': `${R2_BASE}/produtos/brownies/brownie-tradicional.png`,
    // Brownie Leite Ninho / Beijinho
    'produtos/brownies/brownie-leite-ninho': `${R2_BASE}/produtos/brownies/brownie-leite-ninho.png`,
    // Mini Vulcão Cenoura
    'produtos/bolos/mini-vulcao-cenoura-com-chocolate': `${R2_BASE}/produtos/bolos/mini-vulcao-cenoura-com-chocolate.png`,
    // Cookie Ninhotella
    'produtos/cookies/cookie-ninhotella': `${R2_BASE}/produtos/cookies/cookie-ninhotella.png`,
    // Kit de salgados 15 unidades / Marmitinha
    'produtos/salgados/kit-de-salgados-15und': `${R2_BASE}/produtos/salgados/kit-de-salgados-15-unidades.png`,
    'produtos/salgados/marmitinha-de-salgados': `${R2_BASE}/produtos/salgados/kit-de-salgados-15-unidades.png`,
    // Risole de carne
    'produtos/salgados/risole-de-carne': `${R2_BASE}/produtos/salgados/risole-de-carne-20260925142326.png`,
};

export function resolveDisabledCloudinaryUrl(rawUrl, fallback = DEFAULT_IMAGE_FALLBACK) {
    if (!rawUrl || typeof rawUrl !== 'string') return fallback;
    if (!rawUrl.includes('res.cloudinary.com/hhoqdvcp')) return rawUrl;

    for (const [key, replacementUrl] of Object.entries(RECOVERED_IMAGE_MAP)) {
        if (rawUrl.includes(key)) {
            return replacementUrl;
        }
    }
    return fallback;
}

export function sanitizeImageUrl(value, fallback = DEFAULT_IMAGE_FALLBACK) {
    const rawUrl = String(value ?? '').trim();
    if (!rawUrl) return fallback;

    const resolvedUrl = resolveDisabledCloudinaryUrl(rawUrl, fallback);
    if (resolvedUrl === fallback) return fallback;

    try {
        const base = (typeof window !== 'undefined' && window.location) ? window.location.origin : 'http://localhost';
        const parsed = new URL(resolvedUrl, base);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'blob:') {
            return parsed.href;
        }
    } catch {
        return fallback;
    }

    return fallback;
}

export function safeCssToken(value) {
    return String(value ?? '').replace(/[^\w-]/g, '');
}

export function attachImageFallbacks(root, fallback = DEFAULT_IMAGE_FALLBACK) {
    const scope = root || document;
    scope.querySelectorAll('img[data-fallback-src]').forEach((img) => {
        if (img.dataset.fallbackHandlerAttached === 'true') return;
        img.dataset.fallbackHandlerAttached = 'true';
        img.addEventListener('error', () => {
            if (img.dataset.fallbackApplied === 'true') return;
            img.dataset.fallbackApplied = 'true';
            img.classList.add('image-fallback');
            img.src = img.dataset.fallbackSrc || fallback;
        }, { once: true });
    });
}

export function validateImageUrl(url, timeoutMs = 8000) {
    return new Promise((resolve) => {
        const safeUrl = sanitizeImageUrl(url, '');
        if (!safeUrl) {
            resolve(false);
            return;
        }

        const img = new Image();
        const timeout = window.setTimeout(() => {
            img.onload = null;
            img.onerror = null;
            resolve(false);
        }, timeoutMs);

        img.onload = () => {
            window.clearTimeout(timeout);
            resolve(true);
        };

        img.onerror = () => {
            window.clearTimeout(timeout);
            resolve(false);
        };

        img.src = safeUrl;
    });
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
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'absolute';
        textArea.style.left = '-9999px';
        textArea.style.top = '0';

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
    if (hora < 12) return 'Bom dia';
    if (hora < 18) return 'Boa tarde';
    return 'Boa noite';
}
