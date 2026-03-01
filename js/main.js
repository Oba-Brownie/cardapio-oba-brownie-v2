/* ================================================= */
/* ARQUIVO: js/main.js                               */
/* Controlador Principal                             */
/* ================================================= */

import { DADOS_LOJA, LISTA_BAIRROS, IS_BLACK_FRIDAY } from './config/constants.js';
import { fetchConfiguracaoLoja, fetchProducts } from './modules/api.js';
import { renderProducts, initBlackFridayPopup, hideSplashScreen, showNotificacao } from './modules/ui.js';
import { verificarStatusLoja, copyToClipboard } from './modules/utils.js';
import { supabase } from './config/supabase-config.js';

import { 
    initCart, // <-- NOVA FUNÇÃO IMPORTADA AQUI
    addToCart as addToCartModule, 
    setTaxaEntrega, 
    getCart, 
    getCartValues,
    updateQuantity as updateQuantityModule,
    removeFromCart as removeFromCartModule
} from './modules/cart.js';

let todosProdutos = [];
const audioConfirmacao = new Audio('audio/confirmar_encomenda.mp3');

document.addEventListener('DOMContentLoaded', async () => {
    hideSplashScreen();
    initBlackFridayPopup();
    setupBairrosSelect();
    
    // --- GATILHO: Inicia a memória do carrinho assim que o site abre ---
    initCart();

    const config = await fetchConfiguracaoLoja();
    window.chavePixLoja = config.chave_pix;
    let lojaForcadaFechada = false;
    
    if (config) {
        DADOS_LOJA.horarioAbertura = config.horarioAbertura || DADOS_LOJA.horarioAbertura;
        DADOS_LOJA.horarioFechamento = config.horarioFechamento || DADOS_LOJA.horarioFechamento;
        lojaForcadaFechada = !config.lojaAbertaManual; 
    }

    const lojaAberta = config ? config.lojaAbertaManual : false;
    let isScheduling = sessionStorage.getItem('isSchedulingOrder') === 'true';

    if (isScheduling) sessionStorage.removeItem('isSchedulingOrder');
    if (lojaAberta && isScheduling) isScheduling = false;

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

    setupEventListeners(canShop);
    syncDeliveryState();

    const subtotalNode = document.getElementById('subtotal-cart');
    if (subtotalNode) {
        const observer = new MutationObserver(() => {
            if (window.cupomAplicado) window.atualizarResumoDesconto();
        });
        observer.observe(subtotalNode, { characterData: true, childList: true, subtree: true });
    }
});

// =================================================
// EXPOSIÇÃO GLOBAL
// =================================================

window.addToCart = (id) => {
    const produto = todosProdutos.find(p => String(p.id) === String(id));
    if (produto) addToCartModule(produto);
};

window.updateCartItem = (id, novaQtd) => {
    updateQuantityModule(id, novaQtd);
    if(window.cupomAplicado) window.atualizarResumoDesconto();
};

window.removeCartItem = (id) => {
    removeFromCartModule(id);
    if(window.cupomAplicado) window.atualizarResumoDesconto();
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
    if(modal) modal.style.display = 'none';
    window.location.reload(); 
};

// ==========================================
// SISTEMA DE CUPONS
// ==========================================
window.cupomAplicado = null;

window.aplicarCupom = async () => {
    const input = document.getElementById('cupom-input');
    const msg = document.getElementById('cupom-msg');
    const btn = document.getElementById('btn-aplicar-cupom');
    const codigo = input.value.trim().toUpperCase();

    if (!codigo) {
        msg.textContent = "Digite um código válido.";
        msg.style.color = "red";
        return;
    }

    const values = getCartValues();
    if (values.subtotal <= 0) {
        msg.textContent = "Adicione produtos ao carrinho primeiro.";
        msg.style.color = "red";
        return;
    }

    msg.textContent = "Verificando cupom...";
    msg.style.color = "#666";
    btn.disabled = true;

    try {
        const { data, error } = await supabase.from('cupons').select('*').eq('codigo', codigo).single();

        if (error || !data) throw new Error("Cupom inválido ou expirado.");
        if (data.quantidade <= 0) throw new Error("Ops! Este cupom já esgotou.");
        
        if (data.valor_minimo > 0 && values.subtotal < data.valor_minimo) {
            throw new Error(`Mínimo de R$ ${data.valor_minimo.toFixed(2).replace('.', ',')} em produtos.`);
        }

        window.cupomAplicado = data;
        msg.textContent = `✅ Uhuu! Cupom de ${data.desconto_percentual}% aplicado!`;
        msg.style.color = "#28a745"; 
        
        input.disabled = true; 
        btn.textContent = "Remover";
        btn.style.background = "#ff4444"; 
        btn.onclick = removerCupom;
        btn.disabled = false;

        window.atualizarResumoDesconto();

    } catch (err) {
        msg.textContent = "❌ " + err.message;
        msg.style.color = "red";
        window.cupomAplicado = null;
        btn.disabled = false;
    }
};

window.removerCupom = () => {
    window.cupomAplicado = null;
    const input = document.getElementById('cupom-input');
    const msg = document.getElementById('cupom-msg');
    const btn = document.getElementById('btn-aplicar-cupom');

    input.value = '';
    input.disabled = false;
    msg.textContent = '';
    
    const discountLine = document.getElementById('discount-line');
    if (discountLine) discountLine.style.display = 'none'; 
    
    const values = getCartValues();
    const totalNormal = values.subtotal + values.frete + (values.taxaCartao || 0);
    const cartTotal = document.getElementById('cart-total');
    if(cartTotal) cartTotal.textContent = `R$ ${totalNormal.toFixed(2).replace('.', ',')}`;
    
    btn.textContent = "Aplicar";
    btn.style.background = ""; 
    btn.onclick = aplicarCupom;
};

window.atualizarResumoDesconto = () => {
    if (!window.cupomAplicado) return;
    
    const values = getCartValues();
    
    if(values.subtotal === 0 || (window.cupomAplicado.valor_minimo > 0 && values.subtotal < window.cupomAplicado.valor_minimo)) {
        window.removerCupom();
        if (values.subtotal > 0) {
            const msg = document.getElementById('cupom-msg');
            msg.textContent = `❌ Cupom removido: Mínimo de R$ ${window.cupomAplicado.valor_minimo.toFixed(2).replace('.', ',')}`;
            msg.style.color = "red";
        }
        return;
    }

    const valorDesconto = values.subtotal * (window.cupomAplicado.desconto_percentual / 100);
    const taxaCartao = values.taxaCartao || 0; 
    const totalFinal = (values.subtotal - valorDesconto) + values.frete + taxaCartao;

    const discountLine = document.getElementById('discount-line');
    const discountValue = document.getElementById('discount-cart-value');
    const discountName = document.getElementById('discount-name-label');
    const cartTotal = document.getElementById('cart-total');

    if (discountLine && discountValue) {
        discountLine.style.display = 'flex';
        discountValue.textContent = `- R$ ${valorDesconto.toFixed(2).replace('.', ',')}`;
        if(discountName) discountName.textContent = window.cupomAplicado.codigo; 
    }
    
    if (cartTotal) {
        cartTotal.textContent = `R$ ${totalFinal.toFixed(2).replace('.', ',')}`;
    }
};

function setupBairrosSelect() {
    const bairroSelect = document.getElementById('bairro-select');
    if (!bairroSelect) return;
    bairroSelect.innerHTML = '';
    LISTA_BAIRROS.forEach(bairro => {
        const option = document.createElement('option');
        option.value = bairro.nome;
        option.dataset.taxa = bairro.taxa;
        let textoExibicao = bairro.nome;
        if (bairro.taxa > 0) textoExibicao += ` - R$ ${bairro.taxa.toFixed(2).replace('.', ',')}`;
        option.textContent = textoExibicao;
        bairroSelect.appendChild(option);
    });
}

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
            document.getElementById('schedule-order-btn').addEventListener('click', () => {
                sessionStorage.setItem('isSchedulingOrder', 'true');
                window.location.reload();
            });
        }
    }

    if (isScheduling) setupSchedulingUI();
}

function setupSchedulingUI() {
    const schedulingNotice = document.createElement('div');
    schedulingNotice.className = 'scheduling-notice';
    schedulingNotice.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; gap: 10px;">
            <p><strong>Atenção:</strong> Você está no modo de <strong>Agendamento</strong>.</p>
            <button id="cancel-scheduling-btn" style="background: transparent; border: 1px solid #b38200; color: #b38200; padding: 5px 10px; border-radius: 5px; cursor: pointer; font-size: 0.8em;">
                ✕ Sair do Agendamento e Voltar
            </button>
        </div>`;
    document.querySelector('main').prepend(schedulingNotice);

    document.getElementById('cancel-scheduling-btn').addEventListener('click', () => {
        sessionStorage.removeItem('isSchedulingOrder');
        window.location.reload();
    });

    const infoBox = document.getElementById('scheduling-info-box');
    const nextDayDateSpan = document.getElementById('next-day-date');

    if (infoBox && nextDayDateSpan) {
        const agora = new Date();
        const horaAtualDecimal = agora.getHours() + (agora.getMinutes() / 60);
        const dataAgendamento = new Date(agora);

        if (horaAtualDecimal >= DADOS_LOJA.horarioAbertura) dataAgendamento.setDate(dataAgendamento.getDate() + 1);

        const dataFormatada = dataAgendamento.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const isHoje = (dataAgendamento.getDate() === agora.getDate());
        const textoDia = isHoje ? "HOJE" : "AMANHÃ";

        nextDayDateSpan.textContent = dataFormatada;
        schedulingNotice.querySelector('p').innerHTML = `<strong>Atenção:</strong> Você está agendando um pedido para <strong>${textoDia} (${dataFormatada})</strong>.`;
        infoBox.style.display = 'block';
    }

    const timeBox = document.getElementById('scheduling-time-box');
    const timeSelect = document.getElementById('scheduling-time-select');
    if (timeBox && timeSelect) {
        timeSelect.innerHTML = '<option value="">Selecione um horário...</option>';
        for (let time = DADOS_LOJA.horarioAbertura; time <= DADOS_LOJA.horarioFechamento; time += 0.5) {
            const hour = Math.floor(time);
            const minutes = (time % 1) * 60;
            const formattedTime = `${hour.toString()}:${minutes.toString().padStart(2, '0')}`;
            timeSelect.innerHTML += `<option value="${formattedTime}">${formattedTime}</option>`;
        }
        timeBox.style.display = 'block';
    }

    const paymentMethodSelect = document.getElementById('payment-method');
    if (paymentMethodSelect) {
        paymentMethodSelect.value = 'Pix';
        Array.from(paymentMethodSelect.options).forEach(opt => {
            if (opt.value !== 'Pix' && opt.value !== '') opt.disabled = true;
        });
    }
}

function setupEventListeners(canShop) {
    const checkoutButton = document.getElementById('checkout-button');
    const bairroSelect = document.getElementById('bairro-select');
    const paymentMethodSelect = document.getElementById('payment-method');
    const carrinhoFlutuante = document.getElementById('carrinho-flutuante');
    
    if (bairroSelect) {
        bairroSelect.addEventListener('change', (event) => {
            const bairroEncontrado = LISTA_BAIRROS.find(b => b.nome === event.target.value);
            const taxa = bairroEncontrado ? bairroEncontrado.taxa : 0;
            setTaxaEntrega(taxa);
        });
    }

    if (paymentMethodSelect) {
        paymentMethodSelect.addEventListener('change', (event) => {
            const val = event.target.value;
            const trocoSection = document.getElementById('troco-section');
            const taxaInfoBox = document.getElementById('taxa-info');

            if (val === 'Pix') window.openPixPopup();
            
            if (val === 'Dinheiro') {
                trocoSection.style.display = 'block';
            } else {
                trocoSection.style.display = 'none';
                document.getElementById('troco-para').value = '';
            }

            if (val.includes('Cartão')) {
                taxaInfoBox.innerText = `No ${val.toLowerCase()} cobramos taxa.`;
                taxaInfoBox.style.display = 'block';
            } else {
                taxaInfoBox.style.display = 'none';
            }
            
            setTaxaEntrega(parseFloat(document.getElementById('bairro-select').selectedOptions[0]?.dataset?.taxa || 0));
            if(window.cupomAplicado) window.atualizarResumoDesconto();
        });
    }

    document.querySelectorAll('input[name="delivery_type"]').forEach(r => {
        r.addEventListener('change', syncDeliveryState);
    });

    if (carrinhoFlutuante) {
        carrinhoFlutuante.addEventListener('click', () => {
            document.querySelector('.checkout-area').scrollIntoView({ behavior: 'smooth' });
        });
    }

    if (checkoutButton && canShop) {
        checkoutButton.addEventListener('click', handleCheckout);
    }
}

function syncDeliveryState() {
    const selectedOption = document.querySelector('input[name="delivery_type"]:checked');
    const deliveryFields = document.getElementById('delivery-fields');
    const pickupInfo = document.getElementById('pickup-address-info');
    const deliveryFeeLine = document.getElementById('delivery-fee-line');
    const bairroSelect = document.getElementById('bairro-select');

    if (selectedOption && selectedOption.value === 'pickup') {
        if (deliveryFields) deliveryFields.style.display = 'none';
        if (pickupInfo) pickupInfo.style.display = 'block';
        if (deliveryFeeLine) deliveryFeeLine.style.display = 'none';
        
        if (typeof setTaxaEntrega === 'function') setTaxaEntrega(0);
        if (bairroSelect) bairroSelect.selectedIndex = 0;
    } else {
        if (deliveryFields) deliveryFields.style.display = 'block';
        if (pickupInfo) pickupInfo.style.display = 'none';
        if (deliveryFeeLine) deliveryFeeLine.style.display = 'flex';
        
        if (bairroSelect && bairroSelect.value !== "Selecione o bairro...") {
            const option = bairroSelect.selectedOptions[0];
            const taxa = option ? parseFloat(option.dataset.taxa) : 0;
            if (typeof setTaxaEntrega === 'function') setTaxaEntrega(taxa);
        }
    }
    
    if(window.cupomAplicado) window.atualizarResumoDesconto();
}

async function handleCheckout() {
    audioConfirmacao.play().catch(e => console.warn("Áudio bloqueado:", e));
    
    const isScheduling = !!document.querySelector('.scheduling-notice'); 
    const cart = getCart(); 
    const cartValues = getCartValues(); 

    if (cart.length === 0) return alert("Seu carrinho está vazio!");

    const name = document.getElementById('customer-name').value;
    const phone = document.getElementById('customer-phone').value;
    const paymentMethod = document.getElementById('payment-method').value;
    const deliveryType = document.querySelector('input[name="delivery_type"]:checked').value;
    
    if (!name || !paymentMethod) return alert("Por favor, preencha seu nome e a forma de pagamento.");

    const address = document.getElementById('customer-address').value;
    const bairroNome = document.getElementById('bairro-select').value;
    const reference = document.getElementById('customer-reference').value;
    
    if (deliveryType === 'delivery' && (!address || bairroNome === "Selecione o bairro...")) {
        return alert("Para delivery, por favor, preencha o bairro e o endereço.");
    }

    let scheduledTime = '';
    if (isScheduling) {
        scheduledTime = document.getElementById('scheduling-time-select').value;
        if (!scheduledTime) return alert("Por favor, selecione um horário para a entrega ou retirada.");
    }

    if (paymentMethod === 'Pix') {
        const copiouChave = confirm("⚠️ ATENÇÃO ⚠️\n\nComo seu pagamento é via Pix, você precisará enviar o COMPROVANTE no nosso WhatsApp para que o pedido seja preparado.\n\nVocê já copiou a nossa Chave Pix?\nClique em 'OK' para continuar.");
        if (!copiouChave) return; 
    }

    const btn = document.getElementById('checkout-button');
    btn.disabled = true;
    btn.textContent = 'Registrando Pedido...';

    try {
        let subtotalComDesconto = cartValues.subtotal;
        let valorDesconto = cartValues.desconto || 0;
        
        if (window.cupomAplicado) {
            subtotalComDesconto = cartValues.subtotal - valorDesconto;
        }

        const taxaCartao = cartValues.taxaCartao || 0;
        const totalFinal = subtotalComDesconto + cartValues.frete + taxaCartao;

        const itensOtimizados = cart.map(item => ({
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity
        }));

        const pedido = {
            cliente_nome: name,
            cliente_dados: {
                telefone: phone,
                endereco: deliveryType === 'delivery' ? `${address} - ${bairroNome}` : 'Retirada no Local',
                ref: reference, 
                pagamento: paymentMethod,
                troco: document.getElementById('troco-para').value,
                obs: document.getElementById('customer-observation').value,
                tipo: deliveryType,
                horario_agendado: isScheduling ? scheduledTime : null,
                cupom_usado: window.cupomAplicado ? window.cupomAplicado.codigo : null,
                valor_frete: cartValues.frete,          
                taxa_maquininha: taxaCartao,            
                valor_desconto: valorDesconto           
            },
            itens: itensOtimizados, 
            total: totalFinal,
            status: 'Novo',
            data: new Date().toISOString()
        };

        const { error: erroPedido } = await supabase.from('pedidos').insert([pedido]);
        if(erroPedido) throw erroPedido;

        for (const item of cart) {
            const novoEstoque = item.estoque - item.quantity;
            if (novoEstoque >= 0) await supabase.from('produtos').update({ estoque: novoEstoque }).eq('id', item.id);
        }

        if (window.cupomAplicado) {
            const novaQtdCupom = window.cupomAplicado.quantidade - 1;
            await supabase.from('cupons').update({ quantidade: novaQtdCupom }).eq('id', window.cupomAplicado.id);
        }

        const displayName = name.trim().split(' ').slice(0, 2).join(' ');
        const numeroWhatsapp = '5599991675891';
        const TRIANGULOS = "\uD83D\uDD3A\uD83D\uDD3B\uD83D\uDD3A\uD83D\uDD3B\uD83D\uDD3A\uD83D\uDD3B\uD83D\uDD3A\uD83D\uDD3B\uD83D\uDD3A\uD83D\uDD3B\uD83D\uDD3A\uD83D\uDD3B";
        
        let message = `*${TRIANGULOS}*\n\n`;

        if (isScheduling) {
            const dataTexto = document.getElementById('next-day-date').textContent;
            message += `*‼️ PEDIDO AGENDADO ‼️*\n*PARA: ${dataTexto}*\n*HORÁRIO: ${scheduledTime}*\n\n`;
        }
        
        message += `*•••  PEDIDO ${displayName}  •••*\n\n`;

        if (deliveryType === 'pickup') {
            message += `*TIPO:* *RETIRADA NO LOCAL*\n`;
        } else {
            message += `*TIPO:* *DELIVERY*\n*ENDEREÇO:* *${address.trim()}, ${bairroNome}*\n`;
            if (reference) message += `*REF:* *${reference.trim()}*\n`;
            
            if (deliveryType === 'delivery') {
                 message += `\n*VALOR DA ENTREGA:* *R$ ${cartValues.frete.toFixed(2).replace('.', ',')}*\n`;
            }
        }

        message += `\n*PAGAMENTO:* *${paymentMethod}*`;
        
        if (paymentMethod === 'Dinheiro') {
            const troco = document.getElementById('troco-para').value;
            if (troco) message += ` *(Troco para R$ ${troco})*`;
        }
        
        message += `\n`;
        if (phone) message += `\n*TELEFONE:* *${phone}*\n`;
        
        const obs = document.getElementById('customer-observation').value;
        if (obs) message += `\n*OBSERVAÇÃO:* *${obs.trim()}*\n`;
        
        message += `\n--- *ITENS DO PEDIDO* ---\n`;
        cart.forEach(item => {
            message += `*${item.quantity}x ${item.name}* - *R$ ${(item.price * item.quantity).toFixed(2).replace('.', ',')}*\n`;
        });
        
        message += `\n*Subtotal:* *R$ ${cartValues.subtotal.toFixed(2).replace('.', ',')}*`;
        
        if (window.cupomAplicado) {
            message += `\n*🎟️ Cupom (${window.cupomAplicado.codigo}):* *-R$ ${valorDesconto.toFixed(2).replace('.', ',')}*`;
        }
        if (taxaCartao > 0) {
            message += `\n*Taxa Maquininha:* *R$ ${taxaCartao.toFixed(2).replace('.', ',')}*`;
        }
        message += `\n*Total:* *R$ ${totalFinal.toFixed(2).replace('.', ',')}*`;
        message += `\n\n*${TRIANGULOS}*`;

        const whatsappUrl = `https://wa.me/${numeroWhatsapp}?text=${encodeURIComponent(message)}`;
        
        btn.textContent = 'Pedido Registrado!';
        btn.style.backgroundColor = '#4CAF50'; 

        const btnZap = document.getElementById('btn-ir-whatsapp');
        if (btnZap) btnZap.href = whatsappUrl;

        const modalSucesso = document.getElementById('modal-sucesso-pedido');
        if (modalSucesso) modalSucesso.style.display = 'flex';

        // --- GATILHO: Limpa a memória quando o pedido é finalizado ---
        localStorage.removeItem('oba_cart');
        localStorage.removeItem('oba_cart_time');

    } catch (error) {
        alert(error.message);
        btn.disabled = false;
        btn.textContent = 'Enviar Pedido no WhatsApp';
        btn.style.backgroundColor = '';
    }
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then((registration) => {
                console.log('Oba Brownie App registrado com sucesso!', registration.scope);
            })
            .catch((error) => {
                console.error('Falha ao registrar o App:', error);
            });
    });
}