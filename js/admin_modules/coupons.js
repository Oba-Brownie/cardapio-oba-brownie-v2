/* ================================================= */
/* FICHEIRO: js/admin_modules/coupons.js             */
/* Gestão de Cupons de Desconto                      */
/* ================================================= */

import { supabase } from '../config/supabase-config.js';
import { escapeHTML, formatCurrencyBR, inlineJSString, safeNumber } from '../modules/utils.js';
import { LOCAL_TEST_MODE, getMockCupons, showLocalMutationBlocked } from '../modules/local_test_mode.js';

export async function carregarCupons() {
    const div = document.getElementById('lista-cupons');
    if (!div) return;
    
    div.innerHTML = '<p style="text-align:center;"><i class="fas fa-spinner fa-spin"></i> Carregando cupons...</p>';
    
    const { data, error } = LOCAL_TEST_MODE
        ? { data: getMockCupons(), error: null }
        : await supabase.from('cupons').select('*').order('id', { ascending: false });
    
    if (error || !data || data.length === 0) {
        div.innerHTML = '<p style="text-align:center; padding: 20px;">Nenhum cupom ativo no momento.</p>';
        return;
    }
    
    let html = `<table class="tabela-pedidos"><thead><tr><th>Código</th><th>Desconto</th><th>Mínimo</th><th>Restantes</th><th>Ação</th></tr></thead><tbody>`;
    
    data.forEach(c => {
        const qtdStyle = c.quantidade <= 0 ? 'color: red; font-weight: bold;' : '';
        const qtdTexto = c.quantidade <= 0 ? 'Esgotado' : escapeHTML(c.quantidade);
        const minimoTexto = c.valor_minimo > 0 ? `R$ ${formatCurrencyBR(c.valor_minimo)}` : 'Sem mínimo';
        const cupomId = inlineJSString(c.id);

        html += `<tr>
            <td><strong style="color: var(--primary);">${escapeHTML(c.codigo)}</strong></td>
            <td>${safeNumber(c.desconto_percentual)}%</td>
            <td style="font-size:0.9em; color:#666;">${minimoTexto}</td>
            <td style="${qtdStyle}">${qtdTexto}</td>
            <td>
                <button onclick="deletarCupom(${cupomId})" style="background:#ffebee; color:red; border:none; padding:8px 12px; border-radius:5px; cursor:pointer; font-weight:bold;"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`;
    });
    
    html += '</tbody></table>';
    div.innerHTML = html;
}

export async function salvarCupom(e) {
    e.preventDefault();

    if (LOCAL_TEST_MODE) {
        showLocalMutationBlocked('Salvar cupom');
        return;
    }

    const codigo = document.getElementById('c-codigo').value.trim().toUpperCase();
    const desconto = parseFloat(document.getElementById('c-desconto').value);
    const qtd = parseInt(document.getElementById('c-qtd').value);
    const minimo = parseFloat(document.getElementById('c-minimo').value) || 0;

    const { error } = await supabase.from('cupons').insert([{ 
        codigo, 
        desconto_percentual: desconto, 
        quantidade: qtd, 
        valor_minimo: minimo
    }]);

    if (error) {
        if (error.code === '23505') alert("Este código já existe!");
        else alert("Erro ao criar cupom: " + error.message);
    } else {
        document.getElementById('c-codigo').value = '';
        document.getElementById('c-desconto').value = '';
        document.getElementById('c-qtd').value = '';
        document.getElementById('c-minimo').value = '0';
        carregarCupons();
    }
}

export async function deletarCupom(id) {
    if (LOCAL_TEST_MODE) {
        showLocalMutationBlocked('Exclusao de cupom');
        return;
    }

    if (confirm("Deseja apagar este cupom?")) {
        await supabase.from('cupons').delete().eq('id', id);
        carregarCupons();
    }
}
