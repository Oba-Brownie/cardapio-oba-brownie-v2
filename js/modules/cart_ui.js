/* Manipulação de Interface (DOM) do Carrinho */
import { loadCart, addToCartLogic, updateQuantityLogic, removeFromCartLogic, getCart, calculateTotals } from './cart_service.js';

let taxaEntregaAtual = 0;

// === INICIALIZAÇÃO ===
export function initCartUI() {
    loadCart();
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
    const cupomPerc = window.cupomAplicado ? window.cupomAplicado.desconto_percentual : 0;
    
    return calculateTotals(taxaEntregaAtual, cupomPerc, metodoPagamento);
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

window.copiarChavePix = () => {
    const chave = document.getElementById('pix-chave-texto').innerText;
    navigator.clipboard.writeText(chave).then(() => {
        const btn = document.querySelector('#pix-key-line button');
        btn.innerHTML = '<i class="fas fa-check"></i> Copiado!';
        btn.style.background = '#2e7d32'; 
        setTimeout(() => {
            btn.innerHTML = '<i class="fas fa-copy"></i> Copiar';
            btn.style.background = '#4caf50';
        }, 2000);
    }).catch(() => alert("Erro ao copiar a chave."));
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

    container.innerHTML = cart.map(item => `
        <div class="cart-item">
            <div class="item-info">
                <span class="item-name">${item.name}</span>
                <span class="item-price">R$ ${item.price.toFixed(2).replace('.', ',')} un.</span>
            </div>
            <div class="item-controls">
                <span class="quantity-label">Qtd:</span>
                <input type="number" id="qtd-${item.id}" class="quantity-input" value="${item.quantity}" min="1" max="${item.estoque}" oninput="window.updateCartItem('${item.id}', this.value)">
                <button class="remove-button" onclick="window.removeCartItem('${item.id}')" title="Remover">&times;</button>
            </div>
        </div>
    `).join('');
}

function renderCartTotals() {
    const values = getCurrentCartValues(); 
    const elSub = document.getElementById('subtotal-cart');
    const elTotal = document.getElementById('cart-total');
    
    if(elSub) elSub.innerText = `R$ ${values.subtotal.toFixed(2).replace('.', ',')}`;

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

    let pixLine = document.getElementById('pix-key-line');
    if (!pixLine && elTotal) {
        pixLine = document.createElement('div');
        pixLine.id = 'pix-key-line';
        pixLine.style.cssText = "display: flex; flex-direction: column; gap: 8px; padding: 12px; margin-top: 10px; margin-bottom: 10px; background: #e8f5e9; border: 1px dashed #4caf50; border-radius: 8px; color: #2e7d32; font-size: 0.95em;";
        const chave = window.chavePixLoja || 'obabrownie2025@gmail.com';
        pixLine.innerHTML = `
            <div style="font-weight: bold; text-align: center;">Chave Pix para Pagamento:</div>
            <div style="display: flex; align-items: center; justify-content: space-between; background: #fff; padding: 8px 12px; border-radius: 5px; border: 1px solid #a5d6a7;">
                <span id="pix-chave-texto" style="word-break: break-all; font-family: monospace; font-size: 1.1em; color: #333;">${chave}</span>
                <button type="button" onclick="copiarChavePix()" style="background: #4caf50; color: white; border: none; padding: 8px 12px; border-radius: 5px; cursor: pointer; font-size: 0.9em; margin-left: 10px; white-space: nowrap; font-weight: bold; transition: 0.2s;"><i class="fas fa-copy"></i> Copiar</button>
            </div>
            <div style="font-size: 0.85em; text-align: center; color: #666; margin-top: 4px;">Envie o comprovante no WhatsApp ao finalizar o pedido.</div>
        `;
        elTotal.parentElement.parentNode.insertBefore(pixLine, elTotal.parentElement);
    }

    if (pixLine) {
        const paySelect = document.getElementById('payment-method');
        if (paySelect && paySelect.value.toLowerCase().includes('pix')) {
            pixLine.style.display = 'flex';
            const chaveTexto = document.getElementById('pix-chave-texto');
            if (chaveTexto && window.chavePixLoja) chaveTexto.innerText = window.chavePixLoja;
        } else {
            pixLine.style.display = 'none';
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