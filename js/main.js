/* ================================================= */
/* ARQUIVO: js/main.js                               */
/* Principal Cardápio                                */
/* ================================================= */

import { DADOS_LOJA } from './config/constants.js';
import { fetchConfiguracaoLoja, fetchProducts } from './modules/api.js';
import { renderProducts, initBlackFridayPopup, hideSplashScreen } from './modules/ui.js';
import { copyToClipboard } from './modules/utils.js';

import { initCartUI, handleAddToCart } from './modules/cart_ui.js';
import { setupCheckout } from './modules/checkout.js';
import { isSchedulingOrder, clearSchedulingOrder, setSchedulingOrder, setupSchedulingUI } from './modules/scheduling.js';

// Importa apenas para registrar funções no escopo global (HTML)
import './modules/coupons.js';

let todosProdutos = [];

document.addEventListener('DOMContentLoaded', async () => {
    hideSplashScreen();
    initBlackFridayPopup();
    initCartUI();

    const config = await fetchConfiguracaoLoja();
    window.chavePixLoja = config.chave_pix;
    
    let lojaForcadaFechada = false;
    if (config) {
        DADOS_LOJA.horarioAbertura = config.horarioAbertura || DADOS_LOJA.horarioAbertura;
        DADOS_LOJA.horarioFechamento = config.horarioFechamento || DADOS_LOJA.horarioFechamento;
        lojaForcadaFechada = !config.lojaAbertaManual; 
    }

    const lojaAberta = config ? config.lojaAbertaManual : false;
    let isScheduling = isSchedulingOrder();

    if (isScheduling && lojaAberta) {
        clearSchedulingOrder();
        isScheduling = false;
    }

    const canShop = lojaAberta || isScheduling;
    
    handleStoreStatusUI(lojaAberta, lojaForcadaFechada, isScheduling, config);

    if (config.chavePix) {
        const elPix = document.getElementById('pix-key');
        if(elPix) elPix.innerText = config.chavePix;
    }
        
    const elQrImage = document.getElementById('pix-qr-image');
    if (elQrImage && config.qrCodePix) {
        elQrImage.src = config.qrCodePix;
        elQrImage.style.display = 'block';
    }

    try {
        todosProdutos = await fetchProducts();
        renderProducts(todosProdutos, canShop, config.categoriasOrdem);
    } catch (error) {
        console.error("Erro ao carregar produtos:", error);
        document.getElementById('product-list').innerHTML = '<p style="text-align: center; color: red;">Erro ao carregar cardápio.</p>';
    }

    setupCheckout(canShop);

    const subtotalNode = document.getElementById('subtotal-cart');
    if (subtotalNode) {
        const observer = new MutationObserver(() => {
            if (window.cupomAplicado && window.atualizarResumoDesconto) window.atualizarResumoDesconto();
        });
        observer.observe(subtotalNode, { characterData: true, childList: true, subtree: true });
    }
});

function handleStoreStatusUI(lojaAberta, lojaForcadaFechada, isScheduling, config) {
    const btnStatus = document.getElementById('status-loja-btn');
    if (btnStatus) {
        if (lojaAberta) {
            btnStatus.textContent = "Estamos ON!!!";
            btnStatus.classList.add('status-aberto');
            btnStatus.classList.remove('status-fechado');
            btnStatus.href = "#product-list"; 
        } else {
            btnStatus.textContent = "Fechado";
            btnStatus.classList.add('status-fechado');
            btnStatus.classList.remove('status-aberto');
            btnStatus.removeAttribute('href');
            btnStatus.style.cursor = 'default';
        }
    }

    const checkoutButton = document.getElementById('checkout-button');
    const avisoContainer = document.getElementById('aviso-loja-fechada');
    
    if (!lojaAberta && !isScheduling) {
        if (checkoutButton) {
            checkoutButton.disabled = true;
            checkoutButton.textContent = 'Estamos Fechados :(';
        }

        document.body.classList.add('loja-fechada-filter');
        
        let avisoMsg = `<p><strong>${config.mensagemFechado || "Desculpe, estamos fechados no momento!"}</strong></p>`;
        avisoMsg += `<p>Deseja agendar um pedido para o dia seguinte?</p>`;
        avisoMsg += `<button id="schedule-order-btn" class="schedule-order-button">Sim, Agendar Pedido</button>`;
        
        if (avisoContainer) {
            avisoContainer.innerHTML = avisoMsg;
            avisoContainer.style.display = 'block';
            document.getElementById('schedule-order-btn').addEventListener('click', setSchedulingOrder);
        }
    }

    if (isScheduling) setupSchedulingUI();
}

// === EXPOSIÇÃO GLOBAL DE FUNÇÕES HTML ===
window.addToCart = (id) => {
    const produto = todosProdutos.find(p => String(p.id) === String(id));
    if (produto) handleAddToCart(produto);
};

window.openPixPopup = () => { document.getElementById('pix-popup').style.display = 'flex'; };
window.closePixPopup = () => { document.getElementById('pix-popup').style.display = 'none'; };

window.copyPixKey = async () => {
    const key = document.getElementById('pix-key').innerText;
    await copyToClipboard(key);
    alert('Chave Pix copiada!');
};

window.fecharModalSucesso = () => {
    const modal = document.getElementById('modal-sucesso-pedido');
    if (modal) modal.style.display = 'none';
    window.location.reload(); 
};

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(err => console.error(err));
    });
}

// =========================================================
//    ATUALIZAÇÃO INTELIGENTE DE TELA (VISIBILITY API)
// =========================================================
document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible') {
        
        const ultimoRefresh = sessionStorage.getItem('oba_ultimo_refresh');
        const agora = Date.now();

        // Verifica se já passou 1 minuto (60.000 milissegundos) desde a última atualização
        if (!ultimoRefresh || (agora - parseInt(ultimoRefresh)) > 60000) {
            console.log("Atualizando cardápio silenciosamente...");
            
            // Regista a hora desta atualização
            sessionStorage.setItem('oba_ultimo_refresh', agora.toString());
            
            // Destrói o cache antigo do catálogo
            sessionStorage.removeItem('oba_produtos_cache');
            sessionStorage.removeItem('oba_produtos_time');
            
            try {
                const config = await fetchConfiguracaoLoja();
                const lojaAberta = config ? config.lojaAbertaManual : false;
                
                let isScheduling = false;
                if (typeof isSchedulingOrder === 'function') {
                    isScheduling = isSchedulingOrder();
                }
                const canShop = lojaAberta || isScheduling;
                
                todosProdutos = await fetchProducts();
                renderProducts(todosProdutos, canShop, config.categoriasOrdem);
                
                if (typeof handleStoreStatusUI === 'function') {
                    handleStoreStatusUI(lojaAberta, !config.lojaAbertaManual, isScheduling, config);
                }
                
            } catch (error) {
                console.error("Erro ao atualizar o cardápio silenciosamente:", error);
            }
        }
    }
});
