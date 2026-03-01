/* ARQUIVO: js/admin_modules/history.js */
import { supabase } from '../config/supabase-config.js';
import { verDetalhesPedido, imprimirPedido, enviarWhatsAppEntregador } from './orders.js';

function corrigirDataUTC(dataString) {
    if (!dataString) return null;
    if (typeof dataString === 'string' && !dataString.includes('Z') && !dataString.includes('+')) {
        return dataString + 'Z';
    }
    return dataString;
}

function formatarDataBR(dataString) {
    const dataUTC = corrigirDataUTC(dataString);
    if (!dataUTC) return '--/--/----';
    return new Date(dataUTC).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

export async function carregarHistorico() {
    const div = document.getElementById('tabela-historico');
    if(!div) return;
    div.innerHTML = '<div style="text-align:center; padding:20px"><i class="fas fa-spinner fa-spin"></i> Carregando...</div>';
    
    div.style.paddingBottom = "100px"; 
    
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const inicioDoDia = hoje.toISOString();

    const { data } = await supabase.from('pedidos').select('*').lt('data', inicioDoDia).order('data', { ascending: false }).limit(50);
    
    if (!data || data.length === 0) { 
        div.innerHTML = '<p style="text-align:center; padding:20px">Nenhum pedido antigo encontrado.</p>'; 
        return; 
    }
    
    let html = `
        <table class="tabela-pedidos">
            <thead>
                <tr>
                    <th>Data</th>
                    <th>Cliente</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th style="text-align:center">Ações</th>
                </tr>
            </thead>
            <tbody>`;
    
    data.forEach(p => {
        const dataPed = formatarDataBR(p.data);
        const statusBadge = `<span class="badge-status badge-${p.status.replace(' ', '')}">${p.status}</span>`;
        
        html += `
            <tr>
                <td>${dataPed}</td>
                <td>${p.cliente_nome}</td>
                <td>R$ ${parseFloat(p.total).toFixed(2).replace('.', ',')}</td>
                <td>${statusBadge}</td>
                <td style="text-align:center">
                    <button onclick="enviarWhatsAppEntregador('${p.id}')" style="cursor:pointer; border:none; background:transparent; color:#2e7d32; font-size:1.1em; margin-right:8px" title="Mandar p/ Entregador">
                        <i class="fab fa-whatsapp"></i>
                    </button>
                    <button onclick="verDetalhesPedido('${p.id}')" style="cursor:pointer; border:none; background:transparent; color:#1976d2; font-size:1.1em; margin-right:8px" title="Ver Detalhes">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button onclick="imprimirPedido('${p.id}')" style="cursor:pointer; border:none; background:transparent; color:#555; font-size:1.1em; margin-right:8px" title="Reimprimir">
                        <i class="fas fa-print"></i>
                    </button>
                    <button onclick="excluirPedidoHistorico('${p.id}')" style="cursor:pointer; border:none; background:transparent; color:#c62828; font-size:1.1em" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>`;
    });
    html += '</tbody></table>';
    div.innerHTML = html;
}

export function filtrarHistorico(termo) {
    termo = termo.toLowerCase().trim();
    const linhas = document.querySelectorAll('.tabela-pedidos tbody tr');

    linhas.forEach(tr => {
        if (tr.innerText.toLowerCase().includes(termo)) {
            tr.style.display = ''; 
        } else {
            tr.style.display = 'none'; 
        }
    });
}

// --- NOVA FUNÇÃO: EXCLUIR PEDIDO DO HISTÓRICO ---
export async function excluirPedidoHistorico(id) {
    if(confirm("Tem certeza que deseja EXCLUIR este pedido do histórico?")) {
        const { error } = await supabase.from('pedidos').delete().eq('id', id);
        if(error) {
            alert("Erro ao excluir: " + error.message);
        } else {
            carregarHistorico(); // Recarrega a tabela
        }
    }
}
// EXPOSIÇÃO GLOBAL PARA OS BOTÕES DO HTML
window.excluirPedidoHistorico = excluirPedidoHistorico;