/* ================================================= */
/* FICHEIRO: js/admin_modules/orders.js              */
/* Gestão do Monitor de Pedidos em Tempo Real        */
/* ================================================= */

import { supabase } from '../config/supabase-config.js';
import { escapeHTML, formatCurrencyBR, inlineJSString, safeCssToken, safeNumber } from '../modules/utils.js';
import { LOCAL_TEST_MODE, findMockPedido, getMockPedidos, showLocalMutationBlocked } from '../modules/local_test_mode.js';
import { cancelOrderAndReleaseStock, confirmOrderPreparation, getOrderBoardStage, transitionOrderStatus } from './order_workflow.js';

// === UTILITÁRIOS DE DATA E HORA ===
function corrigirDataUTC(dataString) {
    if (!dataString) return null;
    if (typeof dataString === 'string' && !dataString.includes('Z') && !dataString.includes('+')) {
        return dataString + 'Z';
    }
    return dataString;
}

function formatarHoraBR(dataString) {
    const dataUTC = corrigirDataUTC(dataString);
    if (!dataUTC) return '--:--';
    return new Date(dataUTC).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
}

function formatarDataBR(dataString) {
    const dataUTC = corrigirDataUTC(dataString);
    if (!dataUTC) return '--/--/----';
    return new Date(dataUTC).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

function getClienteDados(pedido) {
    return pedido && pedido.cliente_dados && typeof pedido.cliente_dados === 'object' ? pedido.cliente_dados : {};
}

function getStatusClass(status) {
    if (status === 'Visto' || status === 'Em Preparação' || status === 'Em Entrega') return 'Entrega';
    return safeCssToken(String(status ?? '').replace(/\s+/g, ''));
}

function getPrimeiroNome(nome) {
    return String(nome || 'Cliente').trim().split(/\s+/)[0] || 'Cliente';
}

// === CONTROLO DE ECRÃ LIGADO (WAKE LOCK) ===
let wakeLock = null;
let pedidosReloadTimer = null;

function agendarAtualizacaoPedidos() {
    clearTimeout(pedidosReloadTimer);
    pedidosReloadTimer = setTimeout(() => {
        pedidosReloadTimer = null;
        carregarPedidosDoBanco();
    }, 120);
}

async function manterTelaAcordada() {
    if ('wakeLock' in navigator) {
        try {
            wakeLock = await navigator.wakeLock.request('screen');
        } catch (err) {
            console.error(`Erro Wake Lock: ${err.message}`);
        }
    }
}

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && wakeLock !== null) {
        manterTelaAcordada();
    }
});

// === MONITORIZAÇÃO EM TEMPO REAL ===
export async function iniciarMonitor() {
    if (LOCAL_TEST_MODE) {
        carregarPedidosDoBanco();
        return;
    }

    if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
        Notification.requestPermission();
    }
    
    manterTelaAcordada();

    supabase.channel('monitor-loja')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, (payload) => {
            if(payload.eventType === 'INSERT') tocarSom(payload.new);
            agendarAtualizacaoPedidos();
        })
        .subscribe();
        
    carregarPedidosDoBanco();
}

function tocarSom(novoPedido) {
    new Audio('audio/confirmar_encomenda.mp3').play().catch(() => {});

    if ("Notification" in window && Notification.permission === "granted") {
        const nome = novoPedido ? novoPedido.cliente_nome : 'Cliente';
        new Notification("🔔 NOVO PEDIDO OBA BROWNIE!", {
            body: `Pedido recebido de ${nome}. Acesse o painel!`,
            icon: "images/favicon-32x32.png"
        });
    }
}

// === CARREGAMENTO E LISTAGEM ===
export async function carregarPedidosDoBanco() {
    const colNovos = document.getElementById('lista-novos');
    if(colNovos && colNovos.innerHTML === '') {
        colNovos.innerHTML = '<div style="text-align:center; padding:10px; color:#999"><i class="fas fa-spinner fa-spin"></i></div>';
    }

    if (LOCAL_TEST_MODE) {
        distribuirNasColunas(getMockPedidos());
        return;
    }

    const inicioHoje = new Date();
    inicioHoje.setHours(0, 0, 0, 0);

    const inicioAmanha = new Date(inicioHoje);
    inicioAmanha.setDate(inicioAmanha.getDate() + 1);

    // Pedidos ainda novos ficam visíveis até serem preparados ou cancelados, pois mantêm estoque reservado.
    const { data } = await supabase.from('pedidos')
        .select('*')
        .neq('status', 'Arquivado')
        .or(`status.eq.Novo,and(data.gte.${inicioHoje.toISOString()},data.lt.${inicioAmanha.toISOString()})`)
        .order('data', { ascending: true });

    distribuirNasColunas(data || []);
}

function distribuirNasColunas(pedidos) {
    const colNovos = document.getElementById('lista-novos');
    if(!colNovos) return;
    
    document.getElementById('lista-novos').innerHTML = '';
    document.getElementById('lista-entrega').innerHTML = '';
    document.getElementById('lista-concluidos').innerHTML = '';
    
    document.querySelectorAll('.col-body').forEach(col => col.style.paddingBottom = "100px");

    let contadores = { novo: 0, entrega: 0, concluido: 0 };
    
    pedidos.forEach(p => {
        const card = criarCardHTML(p);
        const stage = getOrderBoardStage(p.status);
        if (stage === 'new') {
            document.getElementById('lista-novos').appendChild(card); 
            contadores.novo++; 
        } else if (stage === 'active') {
            document.getElementById('lista-entrega').appendChild(card); 
            contadores.entrega++; 
        } else if (stage === 'done') {
            document.getElementById('lista-concluidos').appendChild(card); 
            contadores.concluido++; 
        }
    });

    if(document.getElementById('count-novos')) document.getElementById('count-novos').innerText = contadores.novo;
    if(document.getElementById('count-entrega')) document.getElementById('count-entrega').innerText = contadores.entrega;
    if(document.getElementById('count-concluidos')) document.getElementById('count-concluidos').innerText = contadores.concluido;
}

function criarCardHTML(p) {
    const div = document.createElement('div');
    const statusClass = getStatusClass(p.status);
    const clienteDados = getClienteDados(p);
    const idArg = inlineJSString(p.id);
    const primeiroNome = escapeHTML(getPrimeiroNome(p.cliente_nome));
    const tipoPedido = clienteDados.tipo === 'pickup' ? 'Retirada' : 'Delivery';
    const tipoIcone = clienteDados.tipo === 'pickup' ? 'fa-walking' : 'fa-motorcycle';
    div.className = `card-pedido status-${statusClass}`;
    
    const hora = formatarHoraBR(p.data);
    
    let itensHTML = '';
    if (Array.isArray(p.itens)) {
        itensHTML = p.itens.slice(0, 2).map(i => `<li><strong>${safeNumber(i.quantity)}x</strong> ${escapeHTML(i.name)}</li>`).join('');
        if (p.itens.length > 2) itensHTML += `<li style="color:#888; font-style:italic">+ ${p.itens.length - 2} itens...</li>`;
    }
    
    let botoesAcao = '';
    if (p.status === 'Novo') {
        const pedidoLegado = p.estoque_status === 'legado';
        botoesAcao = `<button onclick="confirmarPedidoPreparacao(${idArg}, this, ${pedidoLegado})" class="btn-action btn-move-entrega">Confirmar preparo <i class="fas fa-utensils"></i></button>`;
    } else if (p.status === 'Em Preparação') {
        const entregaLabel = clienteDados.tipo === 'pickup' ? 'Pronto para retirada' : 'Enviar para entrega';
        const entregaIcon = clienteDados.tipo === 'pickup' ? 'fa-store' : 'fa-motorcycle';
        botoesAcao = `<button onclick="marcarComoEnviadoEAvisarCliente(${idArg}, this)" class="btn-action btn-move-entrega">${entregaLabel} <i class="fas ${entregaIcon}"></i></button>`;
    } else if (p.status === 'Em Entrega' || p.status === 'Visto') {
        botoesAcao = `<button onclick="mudarStatus(${idArg}, 'Concluido')" class="btn-action btn-move-concluido">Concluir <i class="fas fa-check"></i></button>`;
    }

    const legacyStockWarning = p.status === 'Novo' && p.estoque_status === 'legado'
        ? '<p class="order-stock-warning">Pedido anterior às reservas automáticas. Confira o estoque antes de confirmar.</p>'
        : p.status === 'Novo' && p.estoque_status === 'reservado'
            ? '<p class="order-stock-warning">Estoque reservado para este pedido até iniciar o preparo ou cancelá-lo.</p>'
            : '';

    div.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; border-bottom:1px solid #eee; padding-bottom:5px;">
            <div>
                <strong style="font-size:1.1em">${primeiroNome}</strong>
                <div style="font-size:0.8em; color:#888">${hora}</div>
            </div>
            
            <div style="display:flex; gap:5px">
                <button onclick="enviarWhatsAppEntregador(${idArg})" title="Mandar p/ Entregador" style="background:#e8f5e9; border:none; width:32px; height:32px; border-radius:50%; cursor:pointer; color:#2e7d32;">
                    <i class="fab fa-whatsapp"></i>
                </button>
                <button onclick="verDetalhesPedido(${idArg})" title="Ver Detalhes" style="background:#e3f2fd; border:none; width:32px; height:32px; border-radius:50%; cursor:pointer; color:#1976d2;">
                    <i class="fas fa-eye"></i>
                </button>
                <button onclick="imprimirPedido(${idArg})" title="Imprimir" style="background:#eee; border:none; width:32px; height:32px; border-radius:50%; cursor:pointer; color:#333;">
                    <i class="fas fa-print"></i>
                </button>
                <button onclick="excluirPedido(${idArg})" title="Cancelar pedido e liberar reserva" style="background:#ffebee; border:none; width:32px; height:32px; border-radius:50%; cursor:pointer; color:#c62828;">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>

        <div style="font-size:0.85em; background:#f9f9f9; padding:4px; border-radius:4px; margin-bottom:5px">
            <i class="fas ${tipoIcone}"></i>
            ${tipoPedido}
        </div>

        <ul style="padding-left:20px; margin:5px 0; font-size:0.9em; color:#444">${itensHTML}</ul>
        ${legacyStockWarning}
        
        <div style="margin-top:8px; font-weight:bold; text-align:right; font-size:1em; color:var(--dark)">
            R$ ${formatCurrencyBR(p.total)}
        </div>
        
        <div class="card-actions" style="margin-top:10px">${botoesAcao}</div>`;
    return div;
}

// === AÇÕES DO PEDIDO ===
export async function mudarStatus(id, novoStatus) {
    if (LOCAL_TEST_MODE) {
        showLocalMutationBlocked('Alteracao de status do pedido');
        return;
    }

    let result;
    try {
        result = await transitionOrderStatus(supabase, id, novoStatus);
    } catch {
        result = { error: true };
    }
    if (result.error) {
        alert('Não foi possível atualizar o pedido. Ele continua na etapa atual. Tente novamente.');
        return;
    }

    agendarAtualizacaoPedidos();
}

export async function confirmarPedidoPreparacao(idPedido, button = null, pedidoLegado = false) {
    if (LOCAL_TEST_MODE) {
        showLocalMutationBlocked('Confirmacao/preparacao do pedido');
        return;
    }

    if (pedidoLegado && !confirm('Este pedido já existia antes da baixa automática. Confira e ajuste o estoque manualmente antes de continuar. A confirmação não fará uma nova baixa automática. Deseja continuar?')) {
        return;
    }

    if (button) {
        button.disabled = true;
        button.dataset.originalText = button.textContent;
        button.textContent = 'Confirmando...';
    }

    try {
        const { data, error } = await confirmOrderPreparation(supabase, idPedido, pedidoLegado);
        if (error) {
            if (button) {
                button.disabled = false;
                button.textContent = button.dataset.originalText || 'Confirmar preparo';
            }
            const message = error.code === 'P0001'
                ? 'Estoque insuficiente para confirmar este pedido. Ele permanece em Novos; confira os saldos e tente novamente.'
                : 'Não foi possível confirmar o pedido. Ele permanece em Novos; tente novamente.';
            alert(message);
            return;
        }

        if (data?.estoque_status === 'legado') {
            alert('Pedido movido para preparação sem baixa automática. Confira o estoque manualmente.');
        }
        agendarAtualizacaoPedidos();
    } catch {
        if (button) {
            button.disabled = false;
            button.textContent = button.dataset.originalText || 'Confirmar preparo';
        }
        alert('Falha de comunicação ao confirmar o pedido. Ele permanece em Novos. Atualize o kanban antes de tentar novamente.');
    }
}

export async function excluirPedido(id) {
    if (LOCAL_TEST_MODE) {
        showLocalMutationBlocked('Exclusao de pedido');
        return;
    }

    if(confirm("Remover este pedido? Se ele ainda estiver em Novos, será cancelado e a reserva será liberada. Pedidos antigos serão removidos do histórico.")) {
        const { error } = await cancelOrderAndReleaseStock(supabase, id);
        if(error) alert("Não foi possível cancelar o pedido: " + error.message);
        else carregarPedidosDoBanco();
    }
}

export async function marcarComoEnviadoEAvisarCliente(idPedido, button = null) {
    if (LOCAL_TEST_MODE) {
        showLocalMutationBlocked('Envio/alteracao de pedido');
        return;
    }

    if (button) {
        button.disabled = true;
        button.dataset.originalText = button.textContent;
        button.textContent = 'Atualizando...';
    }

    let statusResult;
    try {
        statusResult = await transitionOrderStatus(supabase, idPedido, 'Em Entrega');
    } catch {
        statusResult = { error: true };
    }
    const statusError = statusResult.error;
    if (statusError) {
        if (button) {
            button.disabled = false;
            button.textContent = button.dataset.originalText || 'Enviar para entrega';
        }
        alert('Não foi possível enviar o pedido para entrega. Ele permanece na etapa atual.');
        return;
    }
    agendarAtualizacaoPedidos();

    const { data: p, error } = await supabase.from('pedidos').select('*').eq('id', idPedido).single();
    if(error || !p) return;

    const telefoneRaw = p.cliente_dados.telefone;
    if (!telefoneRaw || telefoneRaw.trim() === '') {
        alert("Status alterado para 'Em Entrega', mas o cliente não informou número de WhatsApp para ser avisado.");
        return;
    }

    let telefoneCliente = telefoneRaw.replace(/\D/g, '');
    if (telefoneCliente.length === 10 || telefoneCliente.length === 11) {
        telefoneCliente = '55' + telefoneCliente;
    }

    const primeiroNome = p.cliente_nome.split(' ')[0];
    let msg = "";

    if (p.cliente_dados.tipo === 'pickup') {
        msg = `Olá *${primeiroNome}*\n\nPassando para avisar que o seu pedido Oba Brownie já está pronto e separado para Retirada aqui com a gente! 🛍️✨\n\nSe postar fotinha não esquece de nos marcar, caso seu perfil seja privado me avisa pra te seguir de volta e poder compartilhar seu click 💖\n\nObrigada pela preferência e um doce dia! 🩷🍫`;
    } else {
        msg = `Olá *${primeiroNome}*\n\nPassando para avisar que o seu pedido Oba Brownie acabou de sair para entrega com o nosso motoboy! 🛵💨\n\nSe postar fotinha não esquece de nos marcar, caso seu perfil seja privado me avisa pra te seguir de volta e poder compartilhar seu click 💖\n\nObrigada pela preferência e um doce dia! 🩷🍫`;
    }

    window.open(`https://wa.me/${telefoneCliente}?text=${encodeURIComponent(msg)}`, '_blank');
}

// === INTEGRAÇÃO COM MENSAGENS E IMPRESSÃO ===
export async function verDetalhesPedido(id) {
    const modal = document.getElementById('modal-detalhes');
    const conteudo = document.getElementById('det-conteudo');
    modal.classList.add('active');
    conteudo.innerHTML = '<div style="text-align:center; padding:30px"><i class="fas fa-spinner fa-spin fa-2x"></i><p>Buscando dados...</p></div>';

    try {
        const { data: p, error } = LOCAL_TEST_MODE
            ? { data: findMockPedido(id), error: null }
            : await supabase.from('pedidos').select('*').eq('id', id).single();
        if (error || !p) throw new Error("Pedido não encontrado");

        const clienteDados = getClienteDados(p);
        const dataFormatada = formatarDataBR(p.data) + ' às ' + formatarHoraBR(p.data);
        document.getElementById('det-titulo').innerText = `Pedido #${String(p.id).slice(0,4)}`;
        document.getElementById('det-status').innerText = p.status || '--';
        document.getElementById('det-status').className = `badge-status badge-${getStatusClass(p.status)}`;
        document.getElementById('btn-imprimir-modal').onclick = () => imprimirPedido(p.id);

        let itensHtml = (Array.isArray(p.itens) ? p.itens : []).map(i => `
            <div class="item-modal">
                <span><strong>${safeNumber(i.quantity)}x</strong> ${escapeHTML(i.name)}</span>
                <span>R$ ${formatCurrencyBR(safeNumber(i.price) * safeNumber(i.quantity))}</span>
            </div>`).join('');

        const pagamento = escapeHTML(clienteDados.pagamento || '--');
        const troco = clienteDados.troco ? ` (Troco: ${escapeHTML(clienteDados.troco)})` : '';
        const endereco = escapeHTML(clienteDados.endereco || '');
        const observacao = escapeHTML(clienteDados.obs || '');

        conteudo.innerHTML = `
            <div class="detalhes-grid">
                <div><span class="det-label">Cliente</span><span class="det-valor">${escapeHTML(p.cliente_nome)}</span></div>
                <div><span class="det-label">Telefone</span><span class="det-valor">${escapeHTML(clienteDados.telefone || '--')}</span></div>
                <div><span class="det-label">Data</span><span class="det-valor">${dataFormatada}</span></div>
                <div><span class="det-label">Pagamento</span><span class="det-valor">${pagamento}${troco}</span></div>
            </div>
            <div style="background:${clienteDados.tipo === 'delivery' ? '#fff8e1' : '#e3f2fd'}; padding:10px; border-radius:6px; border:1px solid #ddd; margin-bottom:15px;">
                <i class="fas ${clienteDados.tipo === 'delivery' ? 'fa-motorcycle' : 'fa-walking'}"></i>
                <strong>${clienteDados.tipo === 'delivery' ? 'Delivery' : 'Retirada no Local'}</strong>
                ${clienteDados.tipo === 'delivery' ? `<br><small>${endereco}</small>` : ''}
            </div>
            <span class="det-label">Itens:</span>
            <div class="lista-itens-modal">${itensHtml}</div>
            ${observacao ? `<div style="background:#ffebee; color:#c62828; padding:10px; border-radius:5px; margin-bottom:15px; font-weight:bold;">⚠️ Obs: ${observacao}</div>` : ''}
            <div style="text-align:right; font-size:1.2em; border-top:1px solid #eee; padding-top:10px;">
                <span class="det-label" style="display:inline">Total:</span>
                <strong style="color:var(--dark)">R$ ${formatCurrencyBR(p.total)}</strong>
            </div>
        `;
    } catch (e) {
        conteudo.innerHTML = `<p style="color:red; text-align:center">Erro: ${escapeHTML(e.message)}</p>`;
    }
}

export function fecharModalDetalhes() { 
    document.getElementById('modal-detalhes').classList.remove('active'); 
}

export function enviarWhatsAppEntregador(idPedido) {
    if (LOCAL_TEST_MODE) {
        alert('Mensagem simulada localmente. Nenhum WhatsApp foi aberto.');
        return;
    }

    supabase.from('pedidos').select('*').eq('id', idPedido).single()
    .then(({ data: p, error }) => {
        if(error || !p) return alert("Erro ao carregar pedido.");
        
        const TRIANGULOS = "*🔺🔻🔺🔻🔺🔻🔺🔻🔺🔻🔺🔻*";
        const displayName = p.cliente_nome.trim().toUpperCase();
        
        let msg = `${TRIANGULOS}\n\n`;
        
        if (p.cliente_dados.horario_agendado) {
            msg += `*‼️ PEDIDO AGENDADO ‼️*\n*HORÁRIO: ${p.cliente_dados.horario_agendado}*\n\n`;
        }
        
        msg += `*•••  PEDIDO ${displayName}  •••*\n\n`;
        
        let frete = p.cliente_dados.valor_frete || 0;
        let taxa = p.cliente_dados.taxa_maquininha || 0;
        let desconto = p.cliente_dados.valor_desconto || 0;

        let subtotalCalculado = 0;
        p.itens.forEach(item => subtotalCalculado += (item.price * item.quantity));

        if (frete === 0 && taxa === 0 && desconto === 0) {
             const diferenca = parseFloat(p.total) - subtotalCalculado;
             if (diferenca > 0 && p.cliente_dados.tipo === 'delivery') frete = diferenca;
             else if (diferenca < 0) desconto = Math.abs(diferenca);
        }
        
        if (p.cliente_dados.tipo === 'pickup') {
            msg += `*TIPO:* *RETIRADA NO LOCAL*\n\n`;
        } else {
            msg += `*TIPO:* *DELIVERY*\n*ENDEREÇO:* *${p.cliente_dados.endereco}*\n`;
            if (p.cliente_dados.ref) msg += `*REF:* *${p.cliente_dados.ref}*\n`;
        }
        
        msg += `*PAGAMENTO:* *${p.cliente_dados.pagamento}*`;
        if (p.cliente_dados.troco) msg += ` *(Troco para R$ ${p.cliente_dados.troco})*`;
        
        msg += `\n\n*TELEFONE:* *${p.cliente_dados.telefone || 'Não informado'}*\n`;
        
        if (p.cliente_dados.obs) {
            msg += `\n*OBSERVAÇÃO:* *${p.cliente_dados.obs}*\n`;
        }
        
        msg += `\n--- *ITENS DO PEDIDO* ---\n`;
        p.itens.forEach(item => {
            msg += `*${item.quantity}x ${item.name}* - *R$ ${(item.price * item.quantity).toFixed(2).replace('.', ',')}*\n`;
        });
        
        msg += `\n*Subtotal:* *R$ ${subtotalCalculado.toFixed(2).replace('.', ',')}*`;

        if (frete > 0) {
            msg += `\n*VALOR DA ENTREGA:* *R$ ${frete.toFixed(2).replace('.', ',')}*\n`;
        } else {
            msg += `\n`;
        }
        
        if (p.cliente_dados.cupom_usado) {
            msg += `\n*🎟️ Cupom (${p.cliente_dados.cupom_usado}):* *-R$ ${desconto.toFixed(2).replace('.', ',')}*`;
        }
        
        if (taxa > 0) {
            msg += `\n*Taxa Maquininha:* *R$ ${taxa.toFixed(2).replace('.', ',')}*`;
        }
        
        msg += `\n\n*Total:* *R$ ${parseFloat(p.total).toFixed(2).replace('.', ',')}*\n`;
        msg += `${TRIANGULOS}`;
        
        const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
        window.open(url, '_blank');
    });
}

export function imprimirPedido(idPedido) {
    const pedidoPromise = LOCAL_TEST_MODE
        ? Promise.resolve({ data: findMockPedido(idPedido), error: null })
        : supabase.from('pedidos').select('*').eq('id', idPedido).single();

    pedidoPromise.then(({ data: p, error }) => {
        if(error || !p) return alert("Erro ao carregar pedido.");
        
        const clienteDados = getClienteDados(p);
        const dataFormatada = formatarDataBR(p.data) + ' ' + formatarHoraBR(p.data);
        let itensHtml = '';
        (Array.isArray(p.itens) ? p.itens : []).forEach(item => {
            itensHtml += `
                <div class="item-line">
                    <span class="qty">${safeNumber(item.quantity)}x</span>
                    <span class="name">${escapeHTML(item.name)}</span>
                    <span class="price">R$ ${formatCurrencyBR(safeNumber(item.price) * safeNumber(item.quantity))}</span>
                </div>`;
        });

        const cupomHtml = `
            <html>
            <head>
                <title>Pedido #${escapeHTML(p.id)}</title>
                <style>
                    body { font-family: 'Courier New', monospace; width: 300px; margin: 0; padding: 10px; color: #000; }
                    .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 10px; margin-bottom: 10px; }
                    .header h2 { margin: 0; font-size: 1.2rem; }
                    .info { font-size: 0.9rem; margin-bottom: 10px; }
                    .divider { border-bottom: 1px dashed #000; margin: 10px 0; }
                    .item-line { display: flex; justify-content: space-between; font-size: 0.9rem; margin-bottom: 5px; }
                    .qty { font-weight: bold; margin-right: 5px; }
                    .name { flex: 1; }
                    .total { text-align: right; font-size: 1.2rem; font-weight: bold; margin-top: 10px; }
                    .obs { font-weight: bold; margin-top: 10px; background: #eee; padding: 5px; -webkit-print-color-adjust: exact; }
                </style>
            </head>
            <body>
                <div class="header"><h2>OBA BROWNIE</h2><small>${dataFormatada}</small></div>
                <div class="info">
                    <strong>Cliente:</strong> ${escapeHTML(p.cliente_nome)}<br>
                    <strong>Tel:</strong> ${escapeHTML(clienteDados.telefone || '--')}<br>
                    <strong>Tipo:</strong> ${clienteDados.tipo === 'pickup' ? 'RETIRADA' : 'DELIVERY'}
                </div>
                ${clienteDados.tipo === 'delivery' ? `<div class="info"><strong>Endereço:</strong><br>${escapeHTML(clienteDados.endereco)}</div>` : ''}
                <div class="divider"></div>
                ${itensHtml}
                <div class="divider"></div>
                ${clienteDados.cupom_usado ? `<div class="item-line"><span>Cupom:</span><span>${escapeHTML(clienteDados.cupom_usado)}</span></div>` : ''}
                <div class="total">TOTAL: R$ ${formatCurrencyBR(p.total)}</div>
                <div class="info" style="margin-top:5px">
                    Pagamento: <strong>${escapeHTML(clienteDados.pagamento || '--')}</strong>
                    ${clienteDados.troco ? `<br>Troco para: R$ ${escapeHTML(clienteDados.troco)}` : ''}
                </div>
                ${clienteDados.obs ? `<div class="obs">OBS: ${escapeHTML(clienteDados.obs)}</div>` : ''}
                <div style="text-align:center; margin-top:20px; font-size:0.8rem;">--- Fim do Pedido ---</div>
                <script>window.onload = function() { window.print(); window.close(); }</script>
            </body>
            </html>
        `;
        const popup = window.open('', '_blank', 'width=350,height=600');
        popup.document.write(cupomHtml);
        popup.document.close();
    });
}

// === EXPOSIÇÃO GLOBAL PARA OS BOTÕES DO HTML ===
window.marcarComoEnviadoEAvisarCliente = marcarComoEnviadoEAvisarCliente;
window.confirmarPedidoPreparacao = confirmarPedidoPreparacao;
window.excluirPedido = excluirPedido;
window.mudarStatus = mudarStatus;
window.enviarWhatsAppEntregador = enviarWhatsAppEntregador;
window.verDetalhesPedido = verDetalhesPedido;
window.imprimirPedido = imprimirPedido;
window.fecharModalDetalhes = fecharModalDetalhes;
