/* ================================================= */
/* FICHEIRO: js/config/constants.js                  */
/* Variáveis globais e configurações estáticas       */
/* ================================================= */

export const IS_BLACK_FRIDAY = window.location.pathname.includes('blackfriday') || window.location.href.includes('blackfriday');

export const DADOS_LOJA = {
    nome: "Oba Brownie",
    horarioAbertura: 10,
    horarioFechamento: 22,
    diasFuncionamento: [0, 1, 2, 3, 4, 5, 6] 
};

const RAW_BAIRROS = [ 
    { nome: "Barra Azul", taxa: 5.00 }, 
    { nome: "Baixão(depois do teatro)", taxa: 10.00 }, 
    { nome: "Bairro Matadouro", taxa: 5.00 }, 
    { nome: "Bom Jardim", taxa: 8.00 }, 
    { nome: "Brasil Novo (vila Ildemar)", taxa: 10.00 }, 
    { nome: "Capeloza", taxa: 8.00 }, 
    { nome: "Centro", taxa: 6.00 }, 
    { nome: "Cikel", taxa: 7.00},
    { nome: "Colinas Park", taxa: 5.00 }, 
    { nome: "Getat", taxa: 7.00 },
    { nome: "IFMA", taxa: 9.00},
    { nome: "Jacu", taxa: 7.00 }, 
    { nome: "Jardim América", taxa: 9.00 }, 
    { nome: "Jardim Aulidia", taxa: 10.00 }, 
    { nome: "Jardim de Alah", taxa: 8.00 }, 
    { nome: "Jardim Glória I", taxa: 8.00 }, 
    { nome: "Jardim Glória II", taxa: 8.00 }, 
    { nome: "Jardim Glória III", taxa: 8.00 }, 
    { nome: "Jardim Gloria City", taxa: 9.00 }, 
    { nome: "Laranjeiras", taxa: 7.00 }, 
    { nome: "Leolar", taxa: 7.00 }, 
    { nome: "Morro do Urubu", taxa: 11.00 }, 
    { nome: "Nova Açailândia I", taxa: 8.00 }, 
    { nome: "Nova Açailândia II", taxa: 8.00 }, 
    { nome: "Ouro Verde", taxa: 8.00 }, 
    { nome: "Parque da Lagoa", taxa: 9.00 }, 
    { nome: "Parque das Nações", taxa: 11.00 }, 
    { nome: "Parque Planalto", taxa: 9.00 }, 
    { nome: "Pequiá", taxa: 25.00 },
    { nome: "Plano da Serra", taxa: 25 },
    { nome: "Porto Belo", taxa: 4.00 }, 
    { nome: "Porto Seguro I", taxa: 4.00 }, 
    { nome: "Porto Seguro II", taxa: 4.00 }, 
    { nome: "Residencial tropical", taxa: 9.00 }, 
    { nome: "Tancredo", taxa: 8.00 }, 
    { nome: "Vale do Açai", taxa: 16.00 }, 
    { nome: "Vila Flávio Dino", taxa: 7.00 }, 
    { nome: "Vila Ildemar", taxa: 10.00 },
    { nome: "Vila Juscelino", taxa: 10.00},
    { nome: "Vila Maranhão", taxa: 7.00 }, 
    { nome: "Vila São Francisco", taxa: 9.00 }, 
    { nome: "Vila Sucuri", taxa: 7.00 } 
];

export const LISTA_BAIRROS = [...RAW_BAIRROS].sort((a, b) => a.nome.localeCompare(b.nome));
LISTA_BAIRROS.unshift({ nome: "Selecione o bairro...", taxa: 0 });
