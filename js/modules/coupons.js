import { supabase } from '../config/supabase-config.js';
import { getCurrentCartValues } from './cart_ui.js';

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
    const totalNormal = values.subtotal + values.frete + (values.taxaCartao || 0);
    const cartTotal = document.getElementById('cart-total');
    if(cartTotal) cartTotal.textContent = `R$ ${totalNormal.toFixed(2).replace('.', ',')}`;
    
    btn.textContent = "Aplicar";
    btn.style.background = ""; 
    btn.onclick = aplicarCupom;
}

export function atualizarResumoDesconto() {
    if (!window.cupomAplicado) return;
    
    const values = getCurrentCartValues();
    
    if (values.subtotal === 0 || (window.cupomAplicado.valor_minimo > 0 && values.subtotal < window.cupomAplicado.valor_minimo)) {
        removerCupom();
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
}

window.aplicarCupom = aplicarCupom;
window.removerCupom = removerCupom;
window.atualizarResumoDesconto = atualizarResumoDesconto;