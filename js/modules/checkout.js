import { supabase } from '../config/supabase-config.js';
import { LISTA_BAIRROS } from '../config/constants.js';
import { getCart, clearCart } from './cart_service.js';
import { getCurrentCartValues, setTaxaEntregaUI } from './cart_ui.js'; // <-- A calculadora certa está aqui!
import { LOCAL_TEST_MODE } from './local_test_mode.js';
import { copyToClipboard, escapeHTML, formatCurrencyBR, safeNumber } from './utils.js';

const audioConfirmacao = new Audio('audio/confirmar_encomenda.mp3');

export function setupCheckout(canShop) {
    setupBairrosSelect();
    setupEventListeners(canShop);
    syncDeliveryState();
}

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

function setupEventListeners(canShop) {
    const checkoutButton = document.getElementById('checkout-button');
    const bairroSelect = document.getElementById('bairro-select');
    const paymentMethodSelect = document.getElementById('payment-method');
    const carrinhoFlutuante = document.getElementById('carrinho-flutuante');

    if (bairroSelect) {
        bairroSelect.addEventListener('change', (event) => {
            const bairroEncontrado = LISTA_BAIRROS.find(b => b.nome === event.target.value);
            const taxa = bairroEncontrado ? bairroEncontrado.taxa : 0;
            setTaxaEntregaUI(taxa);
        });
    }

    if (paymentMethodSelect) {
        paymentMethodSelect.addEventListener('change', (event) => {
            const val = event.target.value;
            const trocoSection = document.getElementById('troco-section');
            const taxaInfoBox = document.getElementById('taxa-info');

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

            setTaxaEntregaUI(parseFloat(document.getElementById('bairro-select').selectedOptions[0]?.dataset?.taxa || 0));
            if (window.atualizarResumoDesconto) window.atualizarResumoDesconto();
        });
    }

    document.querySelectorAll('input[name="delivery_type"]').forEach(r => {
        r.addEventListener('change', syncDeliveryState);
    });

    if (carrinhoFlutuante) {
        const irParaCheckout = () => {
            document.querySelector('.checkout-area').scrollIntoView({ behavior: 'smooth' });
        };

        carrinhoFlutuante.addEventListener('click', irParaCheckout);
        carrinhoFlutuante.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                irParaCheckout();
            }
        });
    }

    if (checkoutButton && canShop) {
        checkoutButton.addEventListener('click', handleCheckout);
    }
}

export function syncDeliveryState() {
    const selectedOption = document.querySelector('input[name="delivery_type"]:checked');
    const deliveryFields = document.getElementById('delivery-fields');
    const pickupInfo = document.getElementById('pickup-address-info');
    const deliveryFeeLine = document.getElementById('delivery-fee-line');
    const bairroSelect = document.getElementById('bairro-select');

    if (selectedOption && selectedOption.value === 'pickup') {
        if (deliveryFields) deliveryFields.style.display = 'none';
        if (pickupInfo) pickupInfo.style.display = 'block';
        if (deliveryFeeLine) deliveryFeeLine.style.display = 'none';

        setTaxaEntregaUI(0);
        if (bairroSelect) bairroSelect.selectedIndex = 0;
    } else {
        if (deliveryFields) deliveryFields.style.display = 'block';
        if (pickupInfo) pickupInfo.style.display = 'none';
        if (deliveryFeeLine) deliveryFeeLine.style.display = 'flex';

        if (bairroSelect && bairroSelect.value !== "Selecione o bairro...") {
            const option = bairroSelect.selectedOptions[0];
            const taxa = option ? parseFloat(option.dataset.taxa) : 0;
            setTaxaEntregaUI(taxa);
        }
    }

    if (window.atualizarResumoDesconto) window.atualizarResumoDesconto();
}

async function handleCheckout() {
    const isScheduling = !!document.querySelector('.scheduling-notice');
    const cart = getCart();
    const cartValues = getCurrentCartValues(); // <-- CORRIGIDO AQUI TAMBÉM!

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

    const confirmouRevisao = await abrirModalRevisaoPedido({
        cart,
        cartValues,
        paymentMethod,
        deliveryType
    });
    if (!confirmouRevisao) return;

    if (LOCAL_TEST_MODE) {
        return finalizarPedidoMockado();
    }

    audioConfirmacao.play().catch(e => console.warn("Áudio bloqueado:", e));

    const btn = document.getElementById('checkout-button');
    btn.disabled = true;
    btn.textContent = 'Validando itens...';

    // =========================================================
    // 🛡️ NOVA VALIDAÇÃO DE SEGURANÇA (O LEÃO DE CHÁCARA)
    // =========================================================
    try {
        const idsNoCarrinho = cart.map(item => item.id);
        const { data: produtosBanco, error: erroVal } = await supabase
            .from('produtos')
            .select('id, nome, ativo, estoque')
            .in('id', idsNoCarrinho);

        if (!erroVal && produtosBanco) {
            for (const item of cart) {
                // A CORREÇÃO ESTÁ AQUI: Envolver ambos em String() para a comparação bater certo!
                const prodReal = produtosBanco.find(p => String(p.id) === String(item.id));

                if (!prodReal || prodReal.ativo === false) {
                    btn.disabled = false;
                    btn.textContent = 'ENVIAR PEDIDO';
                    return alert(`❌ O produto "${item.name}" não está mais disponível no momento. Por favor, remova-o do carrinho para continuar.`);
                }

                if (prodReal.estoque < item.quantity) {
                    btn.disabled = false;
                    btn.textContent = 'ENVIAR PEDIDO';
                    return alert(`⚠️ Desculpe! Temos apenas ${prodReal.estoque} unidade(s) de "${item.name}" agora. Por favor, ajuste a quantidade no carrinho.`);
                }
            }
        }
    } catch (e) {
        console.warn("Validação offline. O pedido seguirá normalmente via WhatsApp.");
    }
    // =========================================================

    btn.textContent = 'Registrando Pedido...';

    // === CÁLCULOS ===
    let subtotalComDesconto = cartValues.subtotal;
    let valorDesconto = cartValues.desconto || 0;

    if (window.cupomAplicado) {
        subtotalComDesconto = cartValues.subtotal - valorDesconto;
    }

    const taxaCartao = cartValues.taxaCartao || 0;
    const totalFinal = subtotalComDesconto + cartValues.frete + taxaCartao;
    let pedidoRegistradoNoBanco = false;
    const falhasBaixaEstoque = [];

    // === TENTA SALVAR NO BANCO (MODO INDESTRUTÍVEL) ===
    try {
        const itensOtimizados = cart.map(item => ({ id: item.id, name: item.name, price: item.price, quantity: item.quantity }));

        const pedido = {
            cliente_nome: name,
            cliente_dados: {
                telefone: phone,
                endereco: deliveryType === 'delivery' ? `${address} - ${bairroNome}` : 'Retirada no Local',
                ref: reference, pagamento: paymentMethod, troco: document.getElementById('troco-para').value,
                obs: document.getElementById('customer-observation').value, tipo: deliveryType,
                horario_agendado: isScheduling ? scheduledTime : null,
                cupom_usado: window.cupomAplicado ? window.cupomAplicado.codigo : null,
                valor_frete: cartValues.frete, taxa_maquininha: taxaCartao, valor_desconto: valorDesconto
            },
            itens: itensOtimizados, total: totalFinal, status: 'Novo', data: new Date().toISOString()
        };

        const { error: erroPedido } = await supabase.from('pedidos').insert([pedido]);

        if (erroPedido) {
            console.warn("Pedido não registrado no Supabase. Enviando apenas via WhatsApp.", erroPedido);
        } else {
            pedidoRegistradoNoBanco = true;
            // Atualiza estoque no banco
            for (const item of cart) {
                const { data: pAtual, error: erroConsultaEstoque } = await supabase.from('produtos').select('estoque').eq('id', item.id).single();
                if (erroConsultaEstoque || !pAtual) {
                    falhasBaixaEstoque.push(`${item.name}: estoque não consultado`);
                    continue;
                }

                if ((pAtual.estoque - item.quantity) >= 0) {
                    const { error: erroBaixaEstoque } = await supabase
                        .from('produtos')
                        .update({ estoque: pAtual.estoque - item.quantity })
                        .eq('id', item.id);

                    if (erroBaixaEstoque) {
                        falhasBaixaEstoque.push(`${item.name}: ${erroBaixaEstoque.message || 'baixa bloqueada'}`);
                    }
                } else {
                    falhasBaixaEstoque.push(`${item.name}: estoque insuficiente na baixa`);
                }
            }
            if (window.cupomAplicado) {
                const { error: erroBaixaCupom } = await supabase
                    .from('cupons')
                    .update({ quantidade: window.cupomAplicado.quantidade - 1 })
                    .eq('id', window.cupomAplicado.id);
                if (erroBaixaCupom) {
                    console.warn("Cupom aplicado no pedido, mas a quantidade não foi baixada automaticamente.", erroBaixaCupom);
                }
            }
        }
    } catch (e) {
        console.warn("Falha de conexão ao registrar pedido. Prosseguindo para o WhatsApp...", e);
    }

    // === GERAÇÃO DA MENSAGEM DO WHATSAPP ===
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
    }

    message += `\n*PAGAMENTO:* *${paymentMethod}*`;
    if (paymentMethod === 'Dinheiro') {
        const troco = document.getElementById('troco-para').value;
        if (troco) message += ` *(Troco para R$ ${troco})*`;
    }

    message += `\n`;
    if (phone) message += `\n*TELEFONE:* *${phone}*\n`;

    if (!pedidoRegistradoNoBanco) {
        message += `\n*ATENÇÃO INTERNA:* pedido não confirmado no painel automaticamente. Conferir manualmente.\n`;
    } else if (falhasBaixaEstoque.length > 0) {
        message += `\n*ATENÇÃO INTERNA:* pedido registrado, mas a baixa automática de estoque falhou. Conferir estoque manualmente.\n`;
    }

    const obs = document.getElementById('customer-observation').value;
    if (obs) message += `\n*OBSERVAÇÃO:* *${obs.trim()}*\n`;

    message += `\n--- *ITENS DO PEDIDO* ---\n`;
    cart.forEach(item => {
        message += `*${item.quantity}x ${item.name}* - *R$ ${(item.price * item.quantity).toFixed(2).replace('.', ',')}*\n`;
    });

    message += `\n*Subtotal:* *R$ ${cartValues.subtotal.toFixed(2).replace('.', ',')}*`;
    if (deliveryType === 'delivery') message += `\n*VALOR DA ENTREGA:* *R$ ${cartValues.frete.toFixed(2).replace('.', ',')}*\n`;
    if (window.cupomAplicado) message += `\n*🎟️ Cupom (${window.cupomAplicado.codigo}):* *-R$ ${valorDesconto.toFixed(2).replace('.', ',')}*`;
    if (taxaCartao > 0) message += `\n*Taxa Maquininha:* *R$ ${taxaCartao.toFixed(2).replace('.', ',')}*`;
    message += `\n\n*Total:* *R$ ${totalFinal.toFixed(2).replace('.', ',')}*`;
    message += `\n\n*${TRIANGULOS}*`;

    const whatsappUrl = `https://wa.me/${numeroWhatsapp}?text=${encodeURIComponent(message)}`;

    btn.textContent = 'Pedido Registrado!';
    btn.style.backgroundColor = '#4CAF50';

    const btnZap = document.getElementById('btn-ir-whatsapp');
    if (btnZap) btnZap.href = whatsappUrl;

    const modalSucesso = document.getElementById('modal-sucesso-pedido');
    if (modalSucesso) modalSucesso.style.display = 'flex';

    if (!pedidoRegistradoNoBanco) {
        alert("Pedido pronto para enviar no WhatsApp, mas não foi confirmado no painel automaticamente. Avise a loja pelo WhatsApp.");
    } else if (falhasBaixaEstoque.length > 0) {
        alert("Pedido registrado. Atenção: o estoque não foi baixado automaticamente. A loja deve conferir manualmente.");
    }

    localStorage.removeItem('oba_cart');
    localStorage.removeItem('oba_cart_time');
    btn.disabled = false;
}

function finalizarPedidoMockado() {
    const modalSucesso = document.getElementById('modal-sucesso-pedido');
    const btnZap = document.getElementById('btn-ir-whatsapp');

    if (btnZap) {
        btnZap.removeAttribute('href');
        btnZap.onclick = (event) => {
            event.preventDefault();
            alert('Pedido simulado localmente');
        };
    }

    if (modalSucesso) {
        modalSucesso.style.display = 'flex';
    }

    alert('Pedido simulado localmente');
}

function abrirModalRevisaoPedido({ cart, cartValues, paymentMethod, deliveryType }) {
    return new Promise((resolve) => {
        const modal = getOrCreateReviewModal();
        const isPix = paymentMethod === 'Pix';
        const isCard = paymentMethod.includes('Cartão');
        const subtotal = cartValues.subtotal;
        const desconto = cartValues.desconto || 0;
        const frete = deliveryType === 'delivery' ? cartValues.frete : 0;
        const taxaCartao = cartValues.taxaCartao || 0;
        const total = (subtotal - desconto) + frete + taxaCartao;
        const chavePix = window.chavePixLoja || 'obabrownie2025@gmail.com';
        const tipoTaxaCartao = paymentMethod.toLowerCase().includes('crédito') || paymentMethod.toLowerCase().includes('credito')
            ? 'crédito'
            : 'débito';

        const itemsHtml = cart.map(item => {
            const quantity = safeNumber(item.quantity, 1);
            const price = safeNumber(item.price);
            const itemTotal = quantity * price;

            return `
                <div class="order-review-item">
                    <div>
                        <strong>${quantity}x ${escapeHTML(item.name)}</strong>
                        <span>R$ ${formatCurrencyBR(price)} un.</span>
                    </div>
                    <strong>R$ ${formatCurrencyBR(itemTotal)}</strong>
                </div>
            `;
        }).join('');

        const discountHtml = desconto > 0
            ? `<div class="order-review-row discount"><span>Desconto</span><strong>- R$ ${formatCurrencyBR(desconto)}</strong></div>`
            : '';
        const cardFeeHtml = taxaCartao > 0
            ? `<div class="order-review-row warning"><span>Taxa do cartão (${tipoTaxaCartao})</span><strong>R$ ${formatCurrencyBR(taxaCartao)}</strong></div>`
            : '';
        const pixHtml = isPix ? `
            <div class="order-review-pix">
                <div>
                    <span>Chave Pix</span>
                    <strong id="order-review-pix-key">${escapeHTML(chavePix)}</strong>
                </div>
                <button type="button" id="order-review-copy-pix" class="order-review-copy">
                    Copiar Pix
                </button>
            </div>
            <p id="order-review-pix-feedback" class="order-review-feedback" role="status" aria-live="polite"></p>
        ` : '';
        const noteText = isPix
            ? 'Seu pedido apenas será confirmado após o envio do comprovante no nosso WhatsApp.'
            : (isCard ? 'No cartão cobramos taxa.' : 'Confira os dados antes de confirmar o envio do pedido.');

        modal.innerHTML = `
            <div class="order-review-dialog" role="dialog" aria-modal="true" aria-labelledby="order-review-title">
                <div class="order-review-header">
                    <div>
                        <span>Revise seu pedido</span>
                        <h2 id="order-review-title">Está tudo certinho?</h2>
                    </div>
                    <button type="button" class="order-review-close" aria-label="Voltar para editar">
                        &times;
                    </button>
                </div>

                <div class="order-review-body">
                    <div class="order-review-items">${itemsHtml}</div>

                    <div class="order-review-totals">
                        <div class="order-review-row"><span>Subtotal dos produtos</span><strong>R$ ${formatCurrencyBR(subtotal)}</strong></div>
                        ${discountHtml}
                        <div class="order-review-row"><span>Taxa de entrega</span><strong>R$ ${formatCurrencyBR(frete)}</strong></div>
                        ${cardFeeHtml}
                        <div class="order-review-row total"><span>Total</span><strong>R$ ${formatCurrencyBR(total)}</strong></div>
                    </div>

                    ${pixHtml}

                    <div class="order-review-note ${isPix ? 'pix' : isCard ? 'card' : ''}">
                        <strong aria-hidden="true">!</strong>
                        <span>${escapeHTML(noteText)}</span>
                    </div>
                </div>

                <div class="order-review-actions">
                    <button type="button" class="order-review-back">Voltar</button>
                    <button type="button" class="order-review-confirm" ${isPix ? 'disabled' : ''}>
                        Confirmar pedido
                    </button>
                </div>
            </div>
        `;

        document.body.classList.add('order-review-open');
        modal.classList.add('visible');

        const close = (confirmed) => {
            modal.classList.remove('visible');
            document.body.classList.remove('order-review-open');
            resolve(confirmed);
        };

        modal.querySelector('.order-review-close').addEventListener('click', () => close(false));
        modal.querySelector('.order-review-back').addEventListener('click', () => close(false));
        modal.onclick = (event) => {
            if (event.target === modal) close(false);
        };

        const confirmButton = modal.querySelector('.order-review-confirm');
        confirmButton.addEventListener('click', () => close(true));

        const copyButton = modal.querySelector('#order-review-copy-pix');
        if (copyButton) {
            copyButton.addEventListener('click', async () => {
                const feedback = modal.querySelector('#order-review-pix-feedback');

                try {
                    const copied = await copyToClipboard(chavePix);
                    if (!copied) throw new Error('Clipboard indisponível');

                    copyButton.textContent = 'Pix copiado';
                    copyButton.classList.add('copied');
                    confirmButton.disabled = false;
                    if (feedback) feedback.textContent = 'Chave Pix copiada. Agora você pode confirmar o pedido.';
                } catch (error) {
                    confirmButton.disabled = true;
                    if (feedback) feedback.textContent = 'Não conseguimos copiar automaticamente. Toque e segure na chave para copiar.';
                }
            });
        }

        if (copyButton) copyButton.focus();
        else confirmButton.focus();
    });
}

function getOrCreateReviewModal() {
    let modal = document.getElementById('order-review-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'order-review-modal';
        modal.className = 'order-review-modal';
        document.body.appendChild(modal);
    }
    return modal;
}
