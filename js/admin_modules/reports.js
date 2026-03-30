/* ================================================= */
/* FICHEIRO: js/admin_modules/reports.js             */
/* Geração de Relatórios de Faturamento e Produtos   */
/* ================================================= */

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
        const dataInicio = new Date(dataInicioInput + 'T00:00:00').toISOString();
        const dataFim = new Date(dataFimInput + 'T23:59:59').toISOString();

        // Continua leve! Puxa apenas o valor e os itens do banco
        const { data: pedidos, error } = await supabase
            .from('pedidos')
            .select('total, itens')
            .gte('data', dataInicio)
            .lte('data', dataFim)
            .neq('status', 'Cancelado'); 

        if (error) throw error;

        if (!pedidos || pedidos.length === 0) {
            alert("Nenhum pedido encontrado neste período.");
            containerResultado.style.display = 'none';
            return;
        }

        let faturamentoTotal = 0;
        let contagemProdutos = {};

        pedidos.forEach(pedido => {
            faturamentoTotal += parseFloat(pedido.total || 0);

            if (pedido.itens && Array.isArray(pedido.itens)) {
                pedido.itens.forEach(item => {
                    if (!contagemProdutos[item.name]) {
                        contagemProdutos[item.name] = 0;
                    }
                    contagemProdutos[item.name] += item.quantity;
                });
            }
        });

        const produtosOrdenados = Object.keys(contagemProdutos).map(nome => {
            return { nome: nome, quantidade: contagemProdutos[nome] };
        }).sort((a, b) => b.quantidade - a.quantidade);

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

        // === INJEÇÃO DO BOTÃO EXCEL ===
        let btnExcel = document.getElementById('btn-baixar-excel');
        if (!btnExcel) {
            btnExcel = document.createElement('button');
            btnExcel.id = 'btn-baixar-excel';
            btnExcel.className = 'btn-save';
            // Cor verde característica do Excel
            btnExcel.style.backgroundColor = '#107c41'; 
            btnExcel.style.marginTop = '20px';
            btnExcel.innerHTML = '<i class="fas fa-file-excel"></i> Baixar Planilha Excel';
            containerResultado.appendChild(btnExcel);
        }

        // Atrela a função de gerar o ficheiro ao clique do botão
        btnExcel.onclick = () => exportarParaExcel(
            dataInicioInput, 
            dataFimInput, 
            faturamentoTotal, 
            pedidos.length, 
            produtosOrdenados
        );

    } catch (error) {
        console.error("Erro ao gerar relatório:", error);
        alert("Erro ao buscar dados: " + error.message);
    } finally {
        btn.innerText = "GERAR RELATÓRIO";
        btn.disabled = false;
    }
}

// === GERADOR DE EXCEL (CSV) NO NAVEGADOR ===
function exportarParaExcel(dataI, dataF, faturamento, qtdPedidos, produtos) {
    // Monta o cabeçalho do ficheiro com separador de ponto e vírgula para o Excel entender colunas
    let csvContent = "RELATORIO DE VENDAS - OBA BROWNIE\n\n";
    
    // Formata a data para o padrão de Portugal/Brasil (DD/MM/AAAA)
    const formatarData = (d) => d.split('-').reverse().join('/');
    
    csvContent += `Periodo:;${formatarData(dataI)} ate ${formatarData(dataF)}\n`;
    csvContent += `Total de Pedidos:;${qtdPedidos}\n`;
    csvContent += `Faturamento Total:;R$ ${faturamento.toFixed(2).replace('.', ',')}\n\n`;
    
    csvContent += "PRODUTO;QUANTIDADE VENDIDA\n";
    
    // Preenche as linhas com os produtos
    produtos.forEach(p => {
        csvContent += `${p.nome};${p.quantidade}\n`;
    });

    // Adiciona o BOM (Byte Order Mark) para forçar o Excel a ler os acentos corretamente (UTF-8)
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    
    // Cria um link de download invisível e clica nele automaticamente
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", `Relatorio_ObaBrownie_${dataI}_a_${dataF}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}