/* ARQUIVO: js/admin_modules/orders.js */
import { supabase } from '../config/supabase-config.js';

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

// ============================================================
// 🛑 NOVO: SISTEMA PARA MANTER A TELA DO TABLET SEMPRE LIGADA
// ============================================================
let wakeLock = null;

async function manterTelaAcordada() {
    if ('wakeLock' in navigator) {
        try {
            wakeLock = await navigator.wakeLock.request('screen');
            console.log('✅ Wake Lock ativado: A tela do painel não vai mais apagar sozinha!');
            
            wakeLock.addEventListener('release', () => {
                console.log('Wake Lock liberado (tela pode apagar).');
            });
        } catch (err) {
            console.error(`Erro ao tentar manter a tela ligada: ${err.message}`);
        }
    } else {
        console.warn('O navegador não suporta a função de manter a tela ligada.');
    }
}

// Se a vendedora for para outro app e voltar, reativamos a tela ligada
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && wakeLock !== null) {
        manterTelaAcordada();
    }
});
// ============================================================


export async function iniciarMonitor() {
    // 1. Pede permissão pro banner de notificação do Chrome
    if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
        Notification.requestPermission();
    }
    
    // 2. Trava a tela do tablet para não desligar e garantir o alarme
    manterTelaAcordada();

    supabase.channel('monitor-loja')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, (payload) => {
            if(payload.eventType === 'INSERT') tocarSom(payload.new);
            carregarPedidosDoBanco();
        })
        .subscribe();
    carregarPedidosDoBanco();
}

function tocarSom(novoPedido) {
    const audioNovoPedido = new Audio('audio/confirmar_encomenda.mp3');
    audioNovoPedido.play().catch(erro => console.warn("Áudio bloqueado:", erro));

    // Dispara a notificação Push do Sistema Operacional (Bannerzinho)
    if ("Notification" in window && Notification.permission === "granted") {
        const nome = novoPedido ? novoPedido.cliente_nome : 'Cliente';
        new Notification("🔔 NOVO PEDIDO OBA BROWNIE!", {
            body: `Pedido recebido de ${nome}. Acesse o painel!`,
            icon: "images/favicon-32x32.png"
        });
    }
}

export async function carregarPedidosDoBanco() {
    const colNovos = document.getElementById('lista-novos');
    if(colNovos && colNovos.innerHTML === '') colNovos.innerHTML = '<div style="text-align:center; padding:10px; color:#999"><i class="fas fa-spinner fa-spin"></i></div>';

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0); 
    const inicioDoDia = hoje.toISOString();

    const { data } = await supabase.from('pedidos')
        .select('*')
        .gte('data', inicioDoDia)
        .neq('status', 'Arquivado')
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
        if (p.status === 'Novo') { document.getElementById('lista-novos').appendChild(card); contadores.novo++; }
        else if (p.status === 'Em Entrega' || p.status === 'Visto') { document.getElementById('lista-entrega').appendChild(card); contadores.entrega++; }
        else if (p.status === 'Concluido') { document.getElementById('lista-concluidos').appendChild(card); contadores.concluido++; }
    });

    if(document.getElementById('count-novos')) document.getElementById('count-novos').innerText = contadores.novo;
    if(document.getElementById('count-entrega')) document.getElementById('count-entrega').innerText = contadores.entrega;
    if(document.getElementById('count-concluidos')) document.getElementById('count-concluidos').innerText = contadores.concluido;
}

function criarCardHTML(p) {
    const div = document.createElement('div');
    const statusClass = p.status === 'Visto' ? 'Entrega' : p.status;
    div.className = `card-pedido status-${statusClass}`;
    
    const hora = formatarHoraBR(p.data);
    
    let itensHTML = '';
    if (Array.isArray(p.itens)) {
        itensHTML = p.itens.slice(0, 2).map(i => `<li><strong>${i.quantity}x</strong> ${i.name}</li>`).join('');
        if (p.itens.length > 2) itensHTML += `<li style="color:#888; font-style:italic">+ ${p.itens.length - 2} itens...</li>`;
    }
    
    let botoesAcao = '';
    if (p.status === 'Novo') {
        // --- BOTÃO ENVIAR: ESTE AVISA O CLIENTE QUE SAIU ---
        botoesAcao = `<button onclick="marcarComoEnviadoEAvisarCliente('${p.id}')" class="btn-action btn-move-entrega">Enviar <i class="fas fa-motorcycle"></i></button>`;
    } else if (p.status === 'Em Entrega' || p.status === 'Visto') {
        botoesAcao = `<button onclick="mudarStatus('${p.id}', 'Concluido')" class="btn-action btn-move-concluido">Concluir <i class="fas fa-check"></i></button>`;
    }

    div.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; border-bottom:1px solid #eee; padding-bottom:5px;">
            <div>
                <strong style="font-size:1.1em">${p.cliente_nome.split(' ')[0]}</strong>
                <div style="font-size:0.8em; color:#888">${hora}</div>
            </div>
            
            <div style="display:flex; gap:5px">
                <button onclick="enviarWhatsAppEntregador('${p.id}')" title="Mandar p/ Entregador" style="background:#e8f5e9; border:none; width:32px; height:32px; border-radius:50%; cursor:pointer; color:#2e7d32;">
                    <i class="fab fa-whatsapp"></i>
                </button>
                <button onclick="verDetalhesPedido('${p.id}')" title="Ver Detalhes" style="background:#e3f2fd; border:none; width:32px; height:32px; border-radius:50%; cursor:pointer; color:#1976d2;">
                    <i class="fas fa-eye"></i>
                </button>
                <button onclick="imprimirPedido('${p.id}')" title="Imprimir" style="background:#eee; border:none; width:32px; height:32px; border-radius:50%; cursor:pointer; color:#333;">
                    <i class="fas fa-print"></i>
                </button>
                <button onclick="excluirPedido('${p.id}')" title="Excluir Pedido" style="background:#ffebee; border:none; width:32px; height:32px; border-radius:50%; cursor:pointer; color:#c62828;">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>

        <div style="font-size:0.85em; background:#f9f9f9; padding:4px; border-radius:4px; margin-bottom:5px">
            <i class="fas ${p.cliente_dados.tipo === 'pickup' ? 'fa-walking' : 'fa-motorcycle'}"></i> 
            ${p.cliente_dados.tipo === 'pickup' ? 'Retirada' : 'Delivery'}
        </div>

        <ul style="padding-left:20px; margin:5px 0; font-size:0.9em; color:#444">${itensHTML}</ul>
        
        <div style="margin-top:8px; font-weight:bold; text-align:right; font-size:1em; color:var(--dark)">
            R$ ${parseFloat(p.total).toFixed(2).replace('.', ',')}
        </div>
        
        <div class="card-actions" style="margin-top:10px">${botoesAcao}</div>`;
    return div;
}

export async function mudarStatus(id, novoStatus) {
    await supabase.from('pedidos').update({ status: novoStatus }).eq('id', id);
    carregarPedidosDoBanco();
}

// --- FUNÇÃO: EXCLUIR PEDIDO DO DIA ---
export async function excluirPedido(id) {
    if(confirm("Tem certeza que deseja EXCLUIR este pedido? Essa ação não pode ser desfeita.")) {
        const { error } = await supabase.from('pedidos').delete().eq('id', id);
        if(error) {
            alert("Erro ao excluir: " + error.message);
        } else {
            carregarPedidosDoBanco();
        }
    }
}

// --- FUNÇÃO: MOVER E AVISAR CLIENTE ---
export async function marcarComoEnviadoEAvisarCliente(idPedido) {
    // 1. Muda o status no banco para 'Em Entrega'
    await supabase.from('pedidos').update({ status: 'Em Entrega' }).eq('id', idPedido);
    carregarPedidosDoBanco(); // Atualiza a tela

    // 2. Busca os dados para mandar o WhatsApp
    const { data: p, error } = await supabase.from('pedidos').select('*').eq('id', idPedido).single();
    if(error || !p) return;

    const telefoneRaw = p.cliente_dados.telefone;
    if (!telefoneRaw || telefoneRaw.trim() === '') {
        alert("Status alterado para 'Em Entrega', mas o cliente não informou número de WhatsApp para ser avisado.");
        return;
    }

    // Limpa o número de telefone (tira traços, espaços, parênteses)
    let telefoneCliente = telefoneRaw.replace(/\D/g, '');
    
    if (telefoneCliente.length === 10 || telefoneCliente.length === 11) {
        telefoneCliente = '55' + telefoneCliente;
    }

    const primeiroNome = p.cliente_nome.split(' ')[0];
    let msg = "";

    // Verifica se é delivery ou retirada para adaptar apenas a primeira frase
    if (p.cliente_dados.tipo === 'pickup') {
        msg = `Olá *${primeiroNome}*\n\nPassando para avisar que o seu pedido Oba Brownie já está pronto e separado para Retirada aqui com a gente! 🛍️✨\n\nSe postar fotinha não esquece de nos marcar, caso seu perfil seja privado me avisa pra te seguir de volta e poder compartilhar seu click 💖\n\nObrigada pela preferência e um doce dia! 🩷🍫`;
    } else {
        msg = `Olá *${primeiroNome}*\n\nPassando para avisar que o seu pedido Oba Brownie acabou de sair para entrega com o nosso motoboy! 🛵💨\n\nSe postar fotinha não esquece de nos marcar, caso seu perfil seja privado me avisa pra te seguir de volta e poder compartilhar seu click 💖\n\nObrigada pela preferência e um doce dia! 🩷🍫`;
    }

    const urlWhatsApp = `https://wa.me/${telefoneCliente}?text=${encodeURIComponent(msg)}`;
    window.open(urlWhatsApp, '_blank');
}

export async function verDetalhesPedido(id) {
    const modal = document.getElementById('modal-detalhes');
    const conteudo = document.getElementById('det-conteudo');
    modal.classList.add('active');
    conteudo.innerHTML = '<div style="text-align:center; padding:30px"><i class="fas fa-spinner fa-spin fa-2x"></i><p>Buscando dados...</p></div>';

    try {
        const { data: p, error } = await supabase.from('pedidos').select('*').eq('id', id).single();
        if (error || !p) throw new Error("Pedido não encontrado");

        const dataFormatada = formatarDataBR(p.data) + ' às ' + formatarHoraBR(p.data);
        document.getElementById('det-titulo').innerText = `Pedido #${p.id.toString().slice(0,4)}`;
        document.getElementById('det-status').innerText = p.status;
        document.getElementById('det-status').className = `badge-status badge-${p.status === 'Visto' ? 'Entrega' : p.status.replace(' ','')}`;
        document.getElementById('btn-imprimir-modal').onclick = () => imprimirPedido(p.id);

        let itensHtml = p.itens.map(i => `
            <div class="item-modal">
                <span><strong>${i.quantity}x</strong> ${i.name}</span>
                <span>R$ ${(i.price * i.quantity).toFixed(2).replace('.', ',')}</span>
            </div>`).join('');

        conteudo.innerHTML = `
            <div class="detalhes-grid">
                <div><span class="det-label">Cliente</span><span class="det-valor">${p.cliente_nome}</span></div>
                <div><span class="det-label">Telefone</span><span class="det-valor">${p.cliente_dados.telefone || '--'}</span></div>
                <div><span class="det-label">Data</span><span class="det-valor">${dataFormatada}</span></div>
                <div><span class="det-label">Pagamento</span><span class="det-valor">${p.cliente_dados.pagamento} ${p.cliente_dados.troco ? '(Troco: '+p.cliente_dados.troco+')' : ''}</span></div>
            </div>
            <div style="background:${p.cliente_dados.tipo === 'delivery' ? '#fff8e1' : '#e3f2fd'}; padding:10px; border-radius:6px; border:1px solid #ddd; margin-bottom:15px;">
                <i class="fas ${p.cliente_dados.tipo === 'delivery' ? 'fa-motorcycle' : 'fa-walking'}"></i>
                <strong>${p.cliente_dados.tipo === 'delivery' ? 'Delivery' : 'Retirada no Local'}</strong>
                ${p.cliente_dados.tipo === 'delivery' ? `<br><small>${p.cliente_dados.endereco}</small>` : ''}
            </div>
            <span class="det-label">Itens:</span>
            <div class="lista-itens-modal">${itensHtml}</div>
            ${p.cliente_dados.obs ? `<div style="background:#ffebee; color:#c62828; padding:10px; border-radius:5px; margin-bottom:15px; font-weight:bold;">⚠️ Obs: ${p.cliente_dados.obs}</div>` : ''}
            <div style="text-align:right; font-size:1.2em; border-top:1px solid #eee; padding-top:10px;">
                <span class="det-label" style="display:inline">Total:</span>
                <strong style="color:var(--dark)">R$ ${parseFloat(p.total).toFixed(2).replace('.', ',')}</strong>
            </div>
        `;
    } catch (e) {
        conteudo.innerHTML = `<p style="color:red; text-align:center">Erro: ${e.message}</p>`;
    }
}

export function fecharModalDetalhes() { document.getElementById('modal-detalhes').classList.remove('active'); }

export function enviarWhatsAppEntregador(idPedido) {
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
            
            if (frete > 0) {
                msg += `\n*VALOR DA ENTREGA:* *R$ ${frete.toFixed(2).replace('.', ',')}*\n`;
            } else {
                msg += `\n`;
            }
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
        
        if (p.cliente_dados.cupom_usado) {
            msg += `\n*🎟️ Cupom (${p.cliente_dados.cupom_usado}):* *-R$ ${desconto.toFixed(2).replace('.', ',')}*`;
        }
        
        if (taxa > 0) {
            msg += `\n*Taxa Maquininha:* *R$ ${taxa.toFixed(2).replace('.', ',')}*`;
        }
        
        msg += `\n*Total:* *R$ ${parseFloat(p.total).toFixed(2).replace('.', ',')}*\n\n`;
        msg += `${TRIANGULOS}`;
        
        const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
        window.open(url, '_blank');
    });
}

export function imprimirPedido(idPedido) {
    supabase.from('pedidos').select('*').eq('id', idPedido).single()
    .then(({ data: p, error }) => {
        if(error || !p) return alert("Erro ao carregar pedido.");
        
        const dataFormatada = formatarDataBR(p.data) + ' ' + formatarHoraBR(p.data);
        let itensHtml = '';
        p.itens.forEach(item => {
            itensHtml += `
                <div class="item-line">
                    <span class="qty">${item.quantity}x</span>
                    <span class="name">${item.name}</span>
                    <span class="price">R$ ${(item.price * item.quantity).toFixed(2).replace('.', ',')}</span>
                </div>`;
        });

        const cupomHtml = `
            <html>
            <head>
                <title>Pedido #${p.id}</title>
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
                    <strong>Cliente:</strong> ${p.cliente_nome}<br>
                    <strong>Tel:</strong> ${p.cliente_dados.telefone || '--'}<br>
                    <strong>Tipo:</strong> ${p.cliente_dados.tipo === 'pickup' ? 'RETIRADA' : 'DELIVERY'}
                </div>
                ${p.cliente_dados.tipo === 'delivery' ? `<div class="info"><strong>Endereço:</strong><br>${p.cliente_dados.endereco}</div>` : ''}
                <div class="divider"></div>
                ${itensHtml}
                <div class="divider"></div>
                ${p.cliente_dados.cupom_usado ? `<div class="item-line"><span>Cupom:</span><span>${p.cliente_dados.cupom_usado}</span></div>` : ''}
                <div class="total">TOTAL: R$ ${parseFloat(p.total).toFixed(2).replace('.', ',')}</div>
                <div class="info" style="margin-top:5px">
                    Pagamento: <strong>${p.cliente_dados.pagamento}</strong>
                    ${p.cliente_dados.troco ? `<br>Troco para: R$ ${p.cliente_dados.troco}` : ''}
                </div>
                ${p.cliente_dados.obs ? `<div class="obs">OBS: ${p.cliente_dados.obs}</div>` : ''}
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
// EXPOSIÇÃO GLOBAL PARA OS BOTÕES DO HTML
window.marcarComoEnviadoEAvisarCliente = marcarComoEnviadoEAvisarCliente;
window.excluirPedido = excluirPedido;