/* ARQUIVO: js/modules/cart.js */

// Estado interno do carrinho
let cart = [];

// --- INICIALIZAÇÃO DO CARRINHO COM MEMÓRIA ---
export function initCart() {
    const savedCart = localStorage.getItem('oba_cart');
    const savedTime = localStorage.getItem('oba_cart_time');
    
    if (savedCart && savedTime) {
        const now = Date.now();
        const diffMinutes = (now - parseInt(savedTime)) / (1000 * 60);
        
        // 🛑 TRAVA AJUSTADA: Mantém os itens salvos por até 10 minutos
        if (diffMinutes < 10) {
            try {
                cart = JSON.parse(savedCart);
            } catch (e) {
                cart = [];
            }
        } else {
            // Se passou de 10 minutos, limpa a memória
            localStorage.removeItem('oba_cart');
            localStorage.removeItem('oba_cart_time');
        }
    }
    // Renderiza o carrinho na tela se houver itens guardados
    saveAndRender(true);
}

// --- ADICIONAR AO CARRINHO ---
export function addToCart(product) {
    const idProduto = String(product.id);
    const existingItem = cart.find(item => String(item.id) === idProduto);

    if (existingItem) {
        if (existingItem.quantity + 1 > product.estoque) {
            alert("Estoque máximo atingido para este item!");
            return;
        }
        existingItem.quantity += 1;
    } else {
        cart.push({
            id: idProduto,
            name: product.name,
            price: parseFloat(product.price),
            image: product.image,
            estoque: product.estoque,
            quantity: 1
        });
    }

    saveAndRender(true);
    showNotification(`+1 ${product.name} adicionado!`);
}

// --- ATUALIZAR QUANTIDADE ---
export function updateQuantity(id, newQty) {
    const item = cart.find(i => String(i.id) === String(id));
    if (!item) return;

    let qty = parseInt(newQty);
    if (isNaN(qty) || qty < 1) qty = 1; 
    
    if (qty > item.estoque) {
        alert(`Estoque máximo disponível: ${item.estoque}`);
        qty = item.estoque;
        const elInput = document.getElementById(`qtd-${id}`);
        if(elInput) elInput.value = qty;
    }

    item.quantity = qty;
    saveAndRender(false); 
}

// --- REMOVER ITEM ---
export function removeFromCart(id) {
    cart = cart.filter(item => String(item.id) !== String(id));
    saveAndRender(true); 
}

// --- GETTERS (Para uso externo) ---
export function getCart() { return cart; }

export function getCartValues() {
    const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    
    const elTaxa = document.getElementById('taxa-entrega-cart');
    let frete = 0;
    if (elTaxa && !elTaxa.innerText.includes('Grátis')) {
        const texto = elTaxa.innerText.replace('R$', '').replace(',', '.').trim();
        frete = parseFloat(texto) || 0;
    }

    let desconto = 0;
    if (window.cupomAplicado) {
        desconto = subtotal * (window.cupomAplicado.desconto_percentual / 100);
    }

    const paySelect = document.getElementById('payment-method');
    let taxaCartao = 0;
    
    if (paySelect) {
        const val = paySelect.value.toLowerCase();
        const baseCalculo = subtotal - desconto + frete; 
        
        if (val.includes('crédito') || val.includes('credito')) {
            taxaCartao = baseCalculo * 0.0498; 
        } else if (val.includes('débito') || val.includes('debito')) {
            taxaCartao = baseCalculo * 0.0198; 
        }
    }

    return { subtotal, frete, taxaCartao, desconto };
}

export function setTaxaEntrega(valor) {
    const el = document.getElementById('taxa-entrega-cart');
    if(el) el.innerText = `R$ ${valor.toFixed(2).replace('.', ',')}`;
    renderCartTotals(); 
}

// --- SISTEMA DE RENDERIZAÇÃO ---
function saveAndRender(renderList = true) {
    localStorage.setItem('oba_cart', JSON.stringify(cart));
    localStorage.setItem('oba_cart_time', Date.now().toString()); // Atualiza o relógio toda vez que mexer no carrinho
    if (renderList) renderCartList();
    renderCartTotals();
    updateFloatingIcon();
}

function renderCartList() {
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
    const values = getCartValues(); 
    
    const elSub = document.getElementById('subtotal-cart');
    if(elSub) elSub.innerText = `R$ ${values.subtotal.toFixed(2).replace('.', ',')}`;

    const paySelect = document.getElementById('payment-method');
    const val = paySelect ? paySelect.value.toLowerCase() : '';
    const elTotal = document.getElementById('cart-total');

    let taxaCartaoLine = document.getElementById('taxa-cartao-line');
    
    if (!taxaCartaoLine && elTotal) {
        taxaCartaoLine = document.createElement('div');
        taxaCartaoLine.id = 'taxa-cartao-line';
        taxaCartaoLine.style.cssText = "display: flex; justify-content: space-between; padding: 5px 0; color: #d32f2f; font-size: 0.95em;";
        taxaCartaoLine.innerHTML = `<span>Taxa da Maquininha:</span> <span id="taxa-cartao-value">R$ 0,00</span>`;
        const totalContainer = elTotal.parentElement;
        totalContainer.parentNode.insertBefore(taxaCartaoLine, totalContainer);
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
                <button type="button" onclick="copiarChavePix()" style="background: #4caf50; color: white; border: none; padding: 8px 12px; border-radius: 5px; cursor: pointer; font-size: 0.9em; margin-left: 10px; white-space: nowrap; font-weight: bold; transition: 0.2s;">
                    <i class="fas fa-copy"></i> Copiar
                </button>
            </div>
            <div style="font-size: 0.85em; text-align: center; color: #666; margin-top: 4px;">Envie o comprovante no WhatsApp ao finalizar o pedido.</div>
        `;
        const totalContainer = elTotal.parentElement;
        totalContainer.parentNode.insertBefore(pixLine, totalContainer);
    }

    if (pixLine) {
        if (val.includes('pix')) {
            pixLine.style.display = 'flex';
            const chaveTexto = document.getElementById('pix-chave-texto');
            if (chaveTexto && window.chavePixLoja) chaveTexto.innerText = window.chavePixLoja;
        } else {
            pixLine.style.display = 'none';
        }
    }

    const elTotalFinal = document.getElementById('cart-total');
    const totalBasico = (values.subtotal - values.desconto) + values.frete + values.taxaCartao;
    
    if(elTotalFinal) elTotalFinal.innerText = `R$ ${totalBasico.toFixed(2).replace('.', ',')}`;
}

window.copiarChavePix = () => {
    const chave = document.getElementById('pix-chave-texto').innerText;
    navigator.clipboard.writeText(chave).then(() => {
        const btn = document.querySelector('#pix-key-line button');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-check"></i> Copiado!';
        btn.style.background = '#2e7d32'; 
        setTimeout(() => {
            btn.innerHTML = '<i class="fas fa-copy"></i> Copiar';
            btn.style.background = '#4caf50';
        }, 2000);
    }).catch(err => {
        alert("Erro ao copiar a chave. Selecione o texto e copie manualmente.");
    });
};

document.addEventListener('change', (e) => {
    if (e.target.id === 'payment-method') {
        renderCartTotals();
    }
});

function updateFloatingIcon() {
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