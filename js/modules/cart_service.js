/* Lógica de Negócios e Memória do Carrinho */
let cart = [];

// === MEMÓRIA E INICIALIZAÇÃO ===
export function loadCart() {
    const savedCart = localStorage.getItem('oba_cart');
    const savedTime = localStorage.getItem('oba_cart_time');
    
    if (savedCart && savedTime) {
        const diffMinutes = (Date.now() - parseInt(savedTime)) / 60000;
        if (diffMinutes < 10) {
            try { cart = JSON.parse(savedCart); } catch (e) { cart = []; }
        } else {
            clearCart();
        }
    }
    return cart;
}

function saveCartMemory() {
    localStorage.setItem('oba_cart', JSON.stringify(cart));
    localStorage.setItem('oba_cart_time', Date.now().toString());
}

export function clearCart() {
    cart = [];
    localStorage.removeItem('oba_cart');
    localStorage.removeItem('oba_cart_time');
}

// === MANIPULAÇÃO DE ITENS ===
export function getCart() { 
    return cart; 
}

export function syncCartProducts(products = []) {
    const productsById = new Map(products.map(product => [String(product.id), product]));
    let changed = false;

    cart.forEach(item => {
        const product = productsById.get(String(item.id));
        if (!product) return;
        item.name = product.name;
        item.price = parseFloat(product.price);
        item.image = product.image;
        item.estoque = product.estoque;
        item.categoria = product.categoria || 'Outros';
        item.promotion = product.promotion || null;
        changed = true;
    });

    if (changed) saveCartMemory();
}

export function addToCartLogic(product) {
    const idProduto = String(product.id);
    const existingItem = cart.find(i => String(i.id) === idProduto);

    if (existingItem) {
        if (existingItem.quantity + 1 > product.estoque) {
            return { success: false, msg: "Estoque máximo atingido para este item!" };
        }
        existingItem.quantity += 1;
    } else {
        cart.push({
            id: idProduto, name: product.name, price: parseFloat(product.price),
            image: product.image, estoque: product.estoque, categoria: product.categoria || 'Outros', quantity: 1
        });
    }
    saveCartMemory();
    return { success: true, msg: `+1 ${product.name} adicionado!` };
}

export function updateQuantityLogic(id, newQty) {
    const item = cart.find(i => String(i.id) === String(id));
    if (!item) return null;

    let qty = parseInt(newQty);
    if (isNaN(qty) || qty < 1) qty = 1; 
    
    let limitHit = false;
    if (qty > item.estoque) {
        qty = item.estoque;
        limitHit = true;
    }

    item.quantity = qty;
    saveCartMemory();
    return { item, limitHit };
}

export function removeFromCartLogic(id) {
    cart = cart.filter(item => String(item.id) !== String(id));
    saveCartMemory();
}

// === CÁLCULOS MATEMÁTICOS ===
export function calculateTotals(taxaEntrega = 0, desconto = 0, metodoPagamento = '') {
    const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    
    let taxaCartao = 0;
    const baseCalculo = Math.max(0, subtotal - desconto + taxaEntrega);
    const pag = metodoPagamento.toLowerCase();
    
    if (pag.includes('crédito') || pag.includes('credito')) {
        taxaCartao = baseCalculo * 0.0498; 
    } else if (pag.includes('débito') || pag.includes('debito')) {
        taxaCartao = baseCalculo * 0.0198; 
    }

    return { subtotal, frete: taxaEntrega, taxaCartao, desconto };
}
