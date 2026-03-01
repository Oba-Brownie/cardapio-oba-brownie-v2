/* ARQUIVO: js/modules/ui.js */

let notificacaoTimeout;

// --- NOTIFICAÇÕES E POP-UPS ---

export function showNotificacao(mensagem) {
    const notificacao = document.getElementById('notificacao-carrinho');
    if (!notificacao) return;

    notificacao.textContent = mensagem;
    notificacao.classList.add('visible');
    
    clearTimeout(notificacaoTimeout);
    notificacaoTimeout = setTimeout(() => { 
        notificacao.classList.remove('visible'); 
    }, 5000);
}

export function initBlackFridayPopup() {
    const aviso = document.getElementById('aviso-promo-bf');
    if (aviso) {
        setTimeout(() => {
            aviso.classList.add('visivel');
            setTimeout(() => {
                aviso.classList.remove('visivel');
            }, 7000); 
        }, 1000);
    }
}

export function hideSplashScreen() {
    const splashScreen = document.getElementById('splash-screen');
    if (splashScreen) {
        // Força o desaparecimento visual imediatamente
        splashScreen.style.opacity = '0';
        splashScreen.style.transition = 'opacity 0.5s ease';
        
        setTimeout(() => {
            splashScreen.style.display = 'none'; // Remove do fluxo
            splashScreen.classList.add('hidden'); // Mantém compatibilidade com CSS
        }, 500);
    }
}

// --- RENDERIZAÇÃO DE PRODUTOS ---

function generatePriceHTML(product) {
    if (product.price === 0) {
        return `<p class="product-price" style="color: #28a745; font-weight: bold;">Grátis</p>`;
    }
    if (product.originalPrice) {
        return `
            <div class="product-price-container">
                <span class="original-price">R$ ${product.originalPrice.toFixed(2).replace('.', ',')}</span>
                <span class="promo-price">R$ ${product.price.toFixed(2).replace('.', ',')}</span>
            </div>`;
    } 
    return `<p class="product-price">R$ ${product.price.toFixed(2).replace('.', ',')}</p>`;
}

/**
 * Função principal de renderização
 * @param {Array} products - Lista de produtos
 * @param {Boolean} lojaAberta - Status da loja
 * @param {Array} customOrder - (Opcional) Lista com a ordem das categorias
 */
export function renderProducts(products, lojaAberta, customOrder = []) {
    const productListContainer = document.getElementById('product-list');
    const destaquesContainer = document.getElementById('destaques-section');
    
    if (!productListContainer || !destaquesContainer) return;

    productListContainer.innerHTML = '';
    destaquesContainer.innerHTML = '';

    // 1. DESTAQUES
    const destaques = products.filter(p => p.destaque && p.estoque > 0);
    if (destaques.length > 0 && lojaAberta) {
        destaquesContainer.style.display = 'block';
        const title = document.createElement('h3');
        title.className = 'category-title';
        title.textContent = 'Destaques';
        
        const carousel = document.createElement('div');
        carousel.className = 'destaques-carousel';
        
        destaques.forEach(product => {
            const card = document.createElement('div');
            card.className = 'card-destaque';
            card.dataset.productId = product.id;
            const priceHTML = generatePriceHTML(product);

            card.innerHTML = `
                <img src="${product.image}" alt="${product.name}">
                <div class="card-destaque-info">
                    <h4>${product.name}</h4>
                    <p>${product.description}</p>
                    <div class="card-destaque-footer">
                        ${priceHTML}
                        <button class="card-destaque-add-button" onclick="addToCart('${product.id}')">Adicionar</button>
                    </div>
                </div>`;
            carousel.appendChild(card);
        });
        destaquesContainer.appendChild(title);
        destaquesContainer.appendChild(carousel);
    } else {
        destaquesContainer.style.display = 'none';
    }

    // 2. AGRUPAR PRODUTOS POR CATEGORIA
    let productsToRender = lojaAberta ? products.filter(p => p.estoque > 0) : products;

    const productsByCategory = productsToRender.reduce((acc, product) => { 
        // Garante que a categoria tenha um nome padrão se vier vazia
        const cat = product.categoria || 'Outros';
        if (!acc[cat]) acc[cat] = []; 
        acc[cat].push(product); 
        return acc; 
    }, {});

    // 3. DEFINIR A ORDEM DE EXIBIÇÃO
    let finalOrder = [];

    if (customOrder && customOrder.length > 0) {
        // Começa com a ordem que você configurou no painel
        finalOrder = [...customOrder];
        
        // Verifica se tem alguma categoria nos produtos que NÃO está na sua lista personalizada
        // (para evitar que produtos sumam se você criar uma categoria nova e esquecer de ordenar)
        const categoriasExistentes = Object.keys(productsByCategory);
        const categoriasFaltantes = categoriasExistentes.filter(c => !finalOrder.includes(c)).sort();
        
        // Adiciona as faltantes no final
        finalOrder = [...finalOrder, ...categoriasFaltantes];
    } else {
        // Se não tiver configuração, usa a ordem que veio do banco (baseada no campo 'ordem' ou 'id')
        // Extrai as categorias na ordem em que aparecem na lista de produtos
        const categoriesSet = new Set(productsToRender.map(p => p.categoria || 'Outros'));
        finalOrder = Array.from(categoriesSet);
    }

    // 4. RENDERIZAR NA ORDEM FINAL
    finalOrder.forEach(categoria => {
        if (productsByCategory[categoria] && productsByCategory[categoria].length > 0) {
            const categoryTitle = document.createElement('h3');
            categoryTitle.className = 'category-title';
            categoryTitle.textContent = categoria;
            productListContainer.appendChild(categoryTitle);

            productsByCategory[categoria].forEach(product => {
                const productElement = document.createElement('div');
                const priceHTML = generatePriceHTML(product);

                if (!lojaAberta) {
                    productElement.className = 'product-item esgotado';
                    productElement.innerHTML = `
                        <div class="product-info">
                            <h4 class="product-name">${product.name}</h4>
                            <p class="product-description">${product.description}</p>
                            ${priceHTML}
                        </div>
                        <div class="product-image-container">
                            <img src="${product.image}" alt="${product.name}" class="product-image">
                            <button class="add-button-esgotado" disabled>Fechado</button>
                        </div>`;
                } else {
                    productElement.className = 'product-item';
                    productElement.dataset.productId = product.id;
                    productElement.innerHTML = `
                        <div class="product-info">
                            <h4 class="product-name">${product.name}</h4>
                            <p class="product-description">${product.description}</p>
                            ${priceHTML}
                        </div>
                        <div class="product-image-container">
                            <img src="${product.image}" alt="${product.name}" class="product-image">
                            <button class="add-button" onclick="addToCart('${product.id}')">+</button>
                        </div>`;
                }
                productListContainer.appendChild(productElement);
            });
        }
    });

    // 5. RENDERIZA ESGOTADOS (SE LOJA ABERTA)
    if (lojaAberta) {
        const soldOutProducts = products.filter(p => p.estoque <= 0);
        
        if (soldOutProducts.length > 0) {
            const soldOutTitle = document.createElement('h3');
            soldOutTitle.className = 'category-title';
            soldOutTitle.textContent = 'Produtos Esgotados';
            productListContainer.appendChild(soldOutTitle);
            
            soldOutProducts.forEach(product => {
                const productElement = document.createElement('div');
                const priceHTML = generatePriceHTML(product);

                productElement.className = 'product-item esgotado';
                productElement.innerHTML = `
                    <div class="product-info">
                        <h4 class="product-name">${product.name}</h4>
                        <p class="product-description">${product.description}</p>
                        ${priceHTML}
                    </div>
                    <div class="product-image-container">
                        <img src="${product.image}" alt="${product.name}" class="product-image">
                        <button class="add-button-esgotado" disabled>Esgotado</button>
                    </div>`;
                productListContainer.appendChild(productElement);
            });
        }
    }
}