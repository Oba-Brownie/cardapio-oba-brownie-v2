/* ARQUIVO: js/admin_modules/reports.js */
import { supabase } from '../config/supabase-config.js';

export async function gerarRelatorio() {
    const dataInicioInput = document.getElementById('rel-data-inicio').value;
    const dataFimInput = document.getElementById('rel-data-fim').value;
    const btn = document.getElementById('btn-gerar-relatorio');
    const containerResultado = document.getElementById('resultado-relatorio');

    if (!dataInicioInput || !dataFimInput) {
        return alert("Por favor, selecione a data inicial e final.");
    }

    btn.innerText = "Calculando...";
    btn.disabled = true;

    try {
        // Ajusta as datas para cobrir o dia todo (de 00:00:00 até 23:59:59)
        const dataInicio = new Date(dataInicioInput + 'T00:00:00').toISOString();
        const dataFim = new Date(dataFimInput + 'T23:59:59').toISOString();

        // Busca os pedidos no Supabase que não foram cancelados
        const { data: pedidos, error } = await supabase
            .from('pedidos')
            .select('*')
            .gte('data', dataInicio)
            .lte('data', dataFim)
            .neq('status', 'Cancelado'); // Ignora pedidos cancelados na conta

        if (error) throw error;

        if (!pedidos || pedidos.length === 0) {
            alert("Nenhum pedido encontrado neste período.");
            containerResultado.style.display = 'none';
            return;
        }

        let faturamentoTotal = 0;
        let contagemProdutos = {};

        // Varre os pedidos para somar valores e itens
        pedidos.forEach(pedido => {
            faturamentoTotal += parseFloat(pedido.total || 0);

            // Conta os produtos vendidos
            if (pedido.itens && Array.isArray(pedido.itens)) {
                pedido.itens.forEach(item => {
                    if (!contagemProdutos[item.name]) {
                        contagemProdutos[item.name] = 0;
                    }
                    contagemProdutos[item.name] += item.quantity;
                });
            }
        });

        // Transforma o objeto de contagem em um array e ordena do mais vendido pro menos vendido
        const produtosOrdenados = Object.keys(contagemProdutos).map(nome => {
            return { nome: nome, quantidade: contagemProdutos[nome] };
        }).sort((a, b) => b.quantidade - a.quantidade);

        // Atualiza a tela
        document.getElementById('rel-faturamento').innerText = `R$ ${faturamentoTotal.toFixed(2).replace('.', ',')}`;
        document.getElementById('rel-qtd-pedidos').innerText = pedidos.length;

        const listaDiv = document.getElementById('rel-produtos-lista');
        listaDiv.innerHTML = '';

        produtosOrdenados.forEach((prod, index) => {
            const medalha = index === 0 ? '🥇' : (index === 1 ? '🥈' : (index === 2 ? '🥉' : '▪️'));
            listaDiv.innerHTML += `
                <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px dashed #eee;">
                    <span style="font-weight: bold; color: #555;">${medalha} ${prod.nome}</span>
                    <span style="background: var(--primary); color: white; padding: 2px 10px; border-radius: 20px; font-size: 0.9em;">${prod.quantidade} un.</span>
                </div>
            `;
        });

        containerResultado.style.display = 'block';

    } catch (error) {
        console.error("Erro ao gerar relatório:", error);
        alert("Erro ao buscar dados: " + error.message);
    } finally {
        btn.innerText = "GERAR RELATÓRIO";
        btn.disabled = false;
    }
}