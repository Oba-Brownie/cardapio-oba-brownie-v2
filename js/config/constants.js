/* ARQUIVO: js/config/constants.js */

// 1. DETECÇÃO DE AMBIENTE (BLACK FRIDAY)
export const IS_BLACK_FRIDAY = window.location.pathname.includes('blackfriday') || window.location.href.includes('blackfriday');

// 2. CONFIGURAÇÕES DA LOJA
export const DADOS_LOJA = {
    nome: "Oba Brownie",
    horarioAbertura: 10,    // 10:00
    horarioFechamento: 22,  // 22:00
    diasFuncionamento: [0, 1, 2, 3, 4, 5, 6] // Todos os dias
};

// 3. LISTA DE BAIRROS E TAXAS
const RAW_BAIRROS = [ 
    { nome: "Barra Azul", taxa: 5.00 }, 
    { nome: "Baixão(depois do teatro)", taxa: 9.00 }, 
    { nome: "Bairro Matadouro", taxa: 4.00 }, 
    { nome: "Bom Jardim", taxa: 7.00 }, 
    { nome: "Brasil Novo (vila Ildemar)", taxa: 9.00 }, 
    { nome: "Capeloza", taxa: 7.00 }, 
    { nome: "Centro", taxa: 5.00 }, 
    { nome: "Colinas Park", taxa: 3.00 }, 
    { nome: "Getat", taxa: 6.00 }, 
    { nome: "Jacu", taxa: 6.00 }, 
    { nome: "Jardim América", taxa: 8.00 }, 
    { nome: "Jardim Aulidia", taxa: 12.00 }, 
    { nome: "Jardim de Alah", taxa: 7.00 }, 
    { nome: "Jardim Glória I", taxa: 7.00 }, 
    { nome: "Jardim Glória II", taxa: 7.00 }, 
    { nome: "Jardim Glória III", taxa: 7.00 }, 
    { nome: "Jardim Gloria City", taxa: 8.00 }, 
    { nome: "Laranjeiras", taxa: 6.00 }, 
    { nome: "Leolar", taxa: 6.00 }, 
    { nome: "Morro do Urubu", taxa: 10.00 }, 
    { nome: "Nova Açailândia I", taxa: 7.00 }, 
    { nome: "Nova Açailândia II", taxa: 7.00 }, 
    { nome: "Ouro Verde", taxa: 8.00 }, 
    { nome: "Parque da Lagoa", taxa: 8.00 }, 
    { nome: "Parque das Nações", taxa: 10.00 }, 
    { nome: "Parque Planalto", taxa: 8.00 }, 
    { nome: "Porto Belo", taxa: 3.00 }, 
    { nome: "Porto Seguro I", taxa: 3.00 }, 
    { nome: "Porto Seguro II", taxa: 3.00 }, 
    { nome: "Residencial tropical", taxa: 8.00 }, 
    { nome: "Tancredo", taxa: 7.00 }, 
    { nome: "Vale do Açai", taxa: 15.00 }, 
    { nome: "Vila Flávio Dino", taxa: 6.00 }, 
    { nome: "Vila Ildemar", taxa: 9.00 },
    { nome: "Vila Maranhão", taxa: 6.00 }, 
    { nome: "Vila São Francisco", taxa: 8.00 }, 
    { nome: "Vila Sucuri", taxa: 6.00 } 
];

// Exporta lista ordenada
export const LISTA_BAIRROS = [...RAW_BAIRROS].sort((a, b) => a.nome.localeCompare(b.nome));
LISTA_BAIRROS.unshift({ nome: "Selecione o bairro...", taxa: 0 });
