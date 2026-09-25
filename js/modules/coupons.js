import { supabase } from '../config/supabase-config.js';
import { getCurrentCartValues } from './cart_ui.js';
import { LOCAL_TEST_MODE, findMockCupom } from './local_test_mode.js';

window.cupomAplicado = null;

export async function aplicarCupom() {
    const input = document.getElementById('cupom-input');
    const msg = document.getElementById('cupom-msg');
    const btn = document.getElementById('btn-aplicar-cupom');
    const codigo = input.value.trim().toUpperCase();

    if (!codigo) {
        msg.textContent = "Digite um código válido.";
        msg.style.color = "red";
        return;
    }

    const values = getCurrentCartValues();
    if (values.subtotal <= 0) {
        msg.textContent = "Adicione produtos ao carrinho primeiro.";
        msg.style.color = "red";
        return;
    }

    msg.textContent = "Verificando cupom...";
    msg.style.color = "#666";
    btn.disabled = true;

    try {
        let data;
        let error;

        if (LOCAL_TEST_MODE) {
            data = findMockCupom(codigo);
            error = data ? null : new Error('Cupom inválido ou expirado.');
        } else {
            const response = await supabase.rpc('consultar_cupom', { p_codigo: codigo });
            data = Array.isArray(response.data) ? response.data[0] : response.data;
            error = response.error;
        }

        if (error || !data) throw new Error("Cupom inválido ou expirado.");
        if (data.quantidade <= 0) throw new Error("Ops! Este cupom já esgotou.");
        
        if (data.valor_minimo > 0 && values.subtotal < data.valor_minimo) {
            throw new Error(`Mínimo de R$ ${data.valor_minimo.toFixed(2).replace('.', ',')} em produtos.`);
        }

        window.cupomAplicado = {
            ...data,
            target_tipo: data.target_tipo || 'loja',
            target_categoria: data.target_categoria || null
        };
        msg.textContent = `✅ Uhuu! Cupom de ${data.desconto_percentual}% aplicado!`;
        msg.style.color = "#28a745"; 
        
        input.disabled = true; 
        btn.textContent = "Remover";
        btn.style.background = "#ff4444"; 
        btn.onclick = removerCupom;
        btn.disabled = false;

        atualizarResumoDesconto();

    } catch (err) {
        msg.textContent = "❌ " + err.message;
        msg.style.color = "red";
        window.cupomAplicado = null;
        btn.disabled = false;
    }
}

export function removerCupom() {
    window.cupomAplicado = null;
    const input = document.getElementById('cupom-input');
    const msg = document.getElementById('cupom-msg');
    const btn = document.getElementById('btn-aplicar-cupom');

    input.value = '';
    input.disabled = false;
    msg.textContent = '';
    
    const discountLine = document.getElementById('discount-line');
    if (discountLine) discountLine.style.display = 'none'; 
    
    const values = getCurrentCartValues();
    const totalNormal = values.subtotal - (values.promotionDiscount || 0) + values.frete + (values.taxaCartao || 0);
    const cartTotal = document.getElementById('cart-total');
    if(cartTotal) cartTotal.textContent = `R$ ${totalNormal.toFixed(2).replace('.', ',')}`;
    
    btn.textContent = "Aplicar";
    btn.style.background = ""; 
    btn.onclick = aplicarCupom;
}

export function atualizarResumoDesconto() {
    if (!window.cupomAplicado) return;

    const coupon = window.cupomAplicado;
    const values = getCurrentCartValues();
    if (values.subtotal === 0 || (coupon.valor_minimo > 0 && values.subtotal < coupon.valor_minimo)) {
        removerCupom();
        if (values.subtotal > 0) {
            const msg = document.getElementById('cupom-msg');
            msg.textContent = `❌ Cupom removido: mínimo de R$ ${coupon.valor_minimo.toFixed(2).replace('.', ',')} em produtos.`;
            msg.style.color = "red";
        }
        return;
    }

    const valorDesconto = values.couponDiscount || 0;
    const totalFinal = values.subtotal - (values.desconto || 0) + values.frete + (values.taxaCartao || 0);

    const discountLine = document.getElementById('discount-line');
    const discountValue = document.getElementById('discount-cart-value');
    const discountName = document.getElementById('discount-name-label');
    const cartTotal = document.getElementById('cart-total');

    if (discountLine && discountValue) {
        discountLine.style.display = 'flex';
        discountValue.textContent = `- R$ ${valorDesconto.toFixed(2).replace('.', ',')}`;
        if(discountName) discountName.textContent = coupon.codigo;
    }
    
    if (cartTotal) {
        cartTotal.textContent = `R$ ${totalFinal.toFixed(2).replace('.', ',')}`;
    }
}

window.aplicarCupom = aplicarCupom;
window.removerCupom = removerCupom;
window.atualizarResumoDesconto = atualizarResumoDesconto;
