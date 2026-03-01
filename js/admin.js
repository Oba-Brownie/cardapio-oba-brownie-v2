/* ARQUIVO: js/admin.js (Principal Modularizado) */
console.log("Admin.js principal carregado!");

import * as Auth from './admin_modules/auth.js';
import * as Nav from './admin_modules/navigation.js';
import * as Status from './admin_modules/status.js';
import * as Products from './admin_modules/products.js';
import * as Orders from './admin_modules/orders.js';
import * as History from './admin_modules/history.js';
import * as Settings from './admin_modules/settings.js';
import * as Coupons from './admin_modules/coupons.js';
import * as Reports from './admin_modules/reports.js';

// Login & Auth
window.fazerLogin = Auth.login;
window.fazerLogout = Auth.logout;

// Função para ver/esconder senha no login
window.togglePassword = () => {
    const passInput = document.getElementById('login-password');
    const eyeIcon = document.getElementById('eye-icon');
    
    if (passInput.type === 'password') {
        passInput.type = 'text';
        eyeIcon.classList.remove('fa-eye');
        eyeIcon.classList.add('fa-eye-slash'); // Ícone de olho riscado
    } else {
        passInput.type = 'password';
        eyeIcon.classList.remove('fa-eye-slash');
        eyeIcon.classList.add('fa-eye'); // Ícone de olho normal
    }
};

// Navegação
window.nav = Nav.nav;
window.toggleMenu = Nav.toggleMenu;

// Status
window.toggleLojaStatus = Status.toggleLojaStatus;

// Produtos
window.carregarProdutos = Products.carregarProdutos;
window.mostrarPreview = Products.mostrarPreview;
window.prepararEdicao = Products.prepararEdicao;
window.cancelarEdicao = Products.cancelarEdicao;
window.salvarProduto = Products.salvarProduto;
window.deletarProduto = Products.deletarProduto;
window.atualizarSelectCategorias = Products.atualizarSelectCategorias;
window.filtrarProdutos = Products.filtrarProdutos;
window.toggleCategoriaAdmin = Products.toggleCategoriaAdmin;

// Pedidos
window.carregarPedidosDoBanco = Orders.carregarPedidosDoBanco;
window.mudarStatus = Orders.mudarStatus;
window.verDetalhesPedido = Orders.verDetalhesPedido;
window.fecharModalDetalhes = Orders.fecharModalDetalhes;
window.imprimirPedido = Orders.imprimirPedido;
window.enviarWhatsAppEntregador = Orders.enviarWhatsAppEntregador;

// Histórico
window.carregarHistorico = History.carregarHistorico;
window.filtrarHistorico = History.filtrarHistorico;

// Configurações
window.carregarConfiguracoes = Settings.carregarConfiguracoes;
window.salvarConfiguracoesGerais = Settings.salvarConfiguracoesGerais;
window.adicionarCategoriaLista = Settings.adicionarCategoriaLista;
window.removerCategoria = Settings.removerCategoria;
window.salvarOrdemCategorias = Settings.salvarOrdemCategorias;

// Cupons
window.carregarCupons = Coupons.carregarCupons;
window.salvarCupom = Coupons.salvarCupom;
window.deletarCupom = Coupons.deletarCupom;

// Relatórios
window.gerarRelatorio = Reports.gerarRelatorio;

// =========================================================
//  INICIALIZAÇÃO PROTEGIDA
// =========================================================

// Disparado assim que a página abre
document.addEventListener('DOMContentLoaded', () => {
    // Verifica se o usuário tem sessão ativa antes de mostrar o painel
    Auth.verificarSessao();
    
    // Fecha modal se clicar fora (Mantido)
    document.getElementById('modal-detalhes').addEventListener('click', (e) => {
        if(e.target.id === 'modal-detalhes') Orders.fecharModalDetalhes();
    });
});

// Evento customizado disparado APENAS DEPOIS que o login for confirmado
window.addEventListener('auth-success', () => {
    Orders.iniciarMonitor();
    Status.carregarStatusInicial();
    Products.atualizarSelectCategorias();
});