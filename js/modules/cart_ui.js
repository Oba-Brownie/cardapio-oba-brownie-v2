/* Manipulação de Interface (DOM) do Carrinho */
import { loadCart, addToCartLogic, updateQuantityLogic, removeFromCartLogic, getCart, calculateTotals } from './cart_service.js';
import { calculateCartLinePricing } from './cart_pricing.js';
import { escapeHTML, escapeAttribute, formatCurrencyBR, inlineJSString, safeNumber } from './utils.js';

let taxaEntregaAtual = 0;

// === INICIALIZAÇÃO ===
export function initCartUI() {
    loadCart();
    renderAll();
}

export function refreshCartUI() {
    renderAll();
}

// === AÇÕES DE INTERFACE ===
export function handleAddToCart(product) {
    const result = addToCartLogic(product);
    if (!result.success) {
        alert(result.msg);
    } else {
        renderAll();
        showNotification(result.msg);
    }
}

export function setTaxaEntregaUI(valor) {
    taxaEntregaAtual = valor;
    const el = document.getElementById('taxa-entrega-cart');
    if(el) el.innerText = `R$ ${valor.toFixed(2).replace('.', ',')}`;
    renderCartTotals();
}

export function getCurrentCartValues() {
    const paySelect = document.getElementById('payment-method');
    const metodoPagamento = paySelect ? paySelect.value : '';
    const subtotalValues = calculateTotals(taxaEntregaAtual, 0, metodoPagamento);
    const linePricing = getCartLinePricing(subtotalValues.subtotal);
    const promotionDiscount = linePricing.reduce((sum, line) => sum + line.promotionDiscount, 0);
    const coupon = window.cupomAplicado;
    if (!coupon) return { ...calculateTotals(taxaEntregaAtual, promotionDiscount, metodoPagamento), promotionDiscount, couponDiscount: 0 };

    const eligibleSubtotal = coupon.target_tipo === 'frete'
        ? subtotalValues.frete
        : coupon.target_tipo === 'categoria'
            ? linePricing.filter(line => (line.item.categoria || window.obaCategoriasPorProduto?.[String(line.item.id)]) === coupon.target_categoria)
                .reduce((sum, line) => sum + (line.unitPrice * line.item.quantity), 0)
            : Math.max(0, subtotalValues.subtotal - promotionDiscount);
    const couponDiscount = eligibleSubtotal * (safeNumber(coupon.desconto_percentual) / 100);
    return {
        ...calculateTotals(taxaEntregaAtual, promotionDiscount + couponDiscount, metodoPagamento),
        promotionDiscount,
        couponDiscount
    };
}

export function getCartLinePricing(subtotal = null) {
    return calculateCartLinePricing(getCart(), subtotal);
}

// === EXPOSIÇÃO GLOBAL (Para o HTML) ===
window.updateCartItem = (id, novaQtd) => {
    const result = updateQuantityLogic(id, novaQtd);
    if (result && result.limitHit) alert(`Estoque máximo disponível: ${result.item.estoque}`);
    renderAll();
    if(window.cupomAplicado) window.atualizarResumoDesconto();
};

window.removeCartItem = (id) => {
    removeFromCartLogic(id);
    renderAll();
    if(window.cupomAplicado) window.atualizarResumoDesconto();
};

document.addEventListener('change', (e) => {
    if (e.target.id === 'payment-method') renderCartTotals();
});

// === RENDERIZAÇÃO (Desenho na Tela) ===
function renderAll() {
    renderCartList();
    renderCartTotals();
    updateFloatingIcon();
}

function renderCartList() {
    const cart = getCart();
    const container = document.getElementById('cart-items');
    if (!container) return;

    if (cart.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding:20px; color:#888;">Seu carrinho está vazio.</p>';
        return;
    }

    const linePricing = getCartLinePricing();
    container.innerHTML = cart.map((item, index) => {
        const itemId = inlineJSString(item.id);
        const itemIdAttr = escapeAttribute(item.id);
        const itemName = escapeHTML(item.name);
        const pricing = linePricing[index];
        const itemPrice = formatCurrencyBR(pricing.unitPrice);
        const priceHTML = pricing.promotionApplied
            ? `<span class="cart-promo-price"><s>R$ ${formatCurrencyBR(item.price)}</s><strong>R$ ${itemPrice} un.</strong></span>`
            : `<span class="item-price">R$ ${itemPrice} un.</span>`;
        const conditionHTML = item.promotion && !pricing.promotionApplied && safeNumber(item.promotion.valor_minimo) > 0
            ? `<small class="cart-promo-condition">Promoção de ${safeNumber(item.promotion.desconto_percentual)}% a partir de R$ ${formatCurrencyBR(item.promotion.valor_minimo)} no subtotal dos produtos.</small>` : '';
        const itemQuantity = safeNumber(item.quantity, 1);
        const itemStock = safeNumber(item.estoque, 1);

        return `
        <div class="cart-item">
            <div class="item-info">
                <span class="item-name">${itemName}</span>
                ${priceHTML}
                ${conditionHTML}
            </div>
            <div class="item-controls">
                <span class="quantity-label">Qtd:</span>
                <input type="number" id="qtd-${itemIdAttr}" class="quantity-input" value="${itemQuantity}" min="1" max="${itemStock}" oninput="window.updateCartItem(${itemId}, this.value)">
                <button class="remove-button" onclick="window.removeCartItem(${itemId})" title="Remover">&times;</button>
            </div>
        </div>
    `}).join('');
}

function renderCartTotals() {
    const values = getCurrentCartValues();
    const elSub = document.getElementById('subtotal-cart');
    const elTotal = document.getElementById('cart-total');

    if(elSub) elSub.innerText = `R$ ${values.subtotal.toFixed(2).replace('.', ',')}`;

    let promoDiscountLine = document.getElementById('promotion-discount-line');
    if (!promoDiscountLine && elSub?.parentElement) {
        promoDiscountLine = document.createElement('div');
        promoDiscountLine.id = 'promotion-discount-line';
        promoDiscountLine.className = 'total-line discount-line';
        promoDiscountLine.innerHTML = '<span>Desconto de promoções:</span><span id="promotion-discount-value">- R$ 0,00</span>';
        elSub.parentElement.after(promoDiscountLine);
    }
    if (promoDiscountLine) {
        promoDiscountLine.style.display = values.promotionDiscount > 0 ? 'flex' : 'none';
        const promoValue = document.getElementById('promotion-discount-value');
        if (promoValue) promoValue.textContent = `- R$ ${values.promotionDiscount.toFixed(2).replace('.', ',')}`;
    }

    let taxaCartaoLine = document.getElementById('taxa-cartao-line');
    if (!taxaCartaoLine && elTotal) {
        taxaCartaoLine = document.createElement('div');
        taxaCartaoLine.id = 'taxa-cartao-line';
        taxaCartaoLine.style.cssText = "display: flex; justify-content: space-between; padding: 5px 0; color: #d32f2f; font-size: 0.95em;";
        taxaCartaoLine.innerHTML = `<span>Taxa da Maquininha:</span> <span id="taxa-cartao-value">R$ 0,00</span>`;
        elTotal.parentElement.parentNode.insertBefore(taxaCartaoLine, elTotal.parentElement);
    }

    if (taxaCartaoLine) {
        if (values.taxaCartao > 0) {
            taxaCartaoLine.style.display = 'flex';
            document.getElementById('taxa-cartao-value').innerText = `R$ ${values.taxaCartao.toFixed(2).replace('.', ',')}`;
        } else {
            taxaCartaoLine.style.display = 'none';
        }
    }

    if(elTotal) {
        const totalBasico = (values.subtotal - values.desconto) + values.frete + values.taxaCartao;
        elTotal.innerText = `R$ ${totalBasico.toFixed(2).replace('.', ',')}`;
    }
}

function updateFloatingIcon() {
    const cart = getCart();
    const count = cart.reduce((acc, item) => acc + item.quantity, 0);
    const badge = document.getElementById('contador-carrinho');
    const floatingCart = document.getElementById('carrinho-flutuante');

    if (floatingCart) {
        if (count > 0) floatingCart.classList.add('has-items');
        else floatingCart.classList.remove('has-items');
    }

    if (badge) {
        badge.innerText = count;
        if (count > 0) badge.classList.add('visible');
        else badge.classList.remove('visible');
    }
}

function showNotification(msg) {
    const notif = document.getElementById('notificacao-carrinho');
    if(notif) {
        notif.innerText = msg;
        notif.classList.add('visible');
        setTimeout(() => notif.classList.remove('visible'), 2500);
    }
}
