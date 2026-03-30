/* ================================================= */
/* FICHEIRO: js/admin.js                             */
/* Painel Administrativo                             */
/* ================================================= */

import * as Auth from './admin_modules/auth.js';
import * as Nav from './admin_modules/navigation.js';
import * as Status from './admin_modules/status.js';
import * as Products from './admin_modules/products.js';
import * as Orders from './admin_modules/orders.js';
import * as History from './admin_modules/history.js';
import * as Settings from './admin_modules/settings.js';
import * as Coupons from './admin_modules/coupons.js';
import * as Reports from './admin_modules/reports.js';

// === EXPOSIÇÃO GLOBAL (Para uso direto no HTML) ===
window.fazerLogin = Auth.login;
window.fazerLogout = Auth.logout;

window.togglePassword = () => {
    const passInput = document.getElementById('login-password');
    const eyeIcon = document.getElementById('eye-icon');
    
    if (passInput.type === 'password') {
        passInput.type = 'text';
        eyeIcon.classList.remove('fa-eye');
        eyeIcon.classList.add('fa-eye-slash');
    } else {
        passInput.type = 'password';
        eyeIcon.classList.remove('fa-eye-slash');
        eyeIcon.classList.add('fa-eye');
    }
};

window.nav = Nav.nav;
window.toggleMenu = Nav.toggleMenu;

window.toggleLojaStatus = Status.toggleLojaStatus;

window.carregarProdutos = Products.carregarProdutos;
window.mostrarPreview = Products.mostrarPreview;
window.prepararEdicao = Products.prepararEdicao;
window.cancelarEdicao = Products.cancelarEdicao;
window.salvarProduto = Products.salvarProduto;
window.deletarProduto = Products.deletarProduto;
window.atualizarSelectCategorias = Products.atualizarSelectCategorias;
window.filtrarProdutos = Products.filtrarProdutos;
window.toggleCategoriaAdmin = Products.toggleCategoriaAdmin;

window.carregarPedidosDoBanco = Orders.carregarPedidosDoBanco;
window.mudarStatus = Orders.mudarStatus;
window.verDetalhesPedido = Orders.verDetalhesPedido;
window.fecharModalDetalhes = Orders.fecharModalDetalhes;
window.imprimirPedido = Orders.imprimirPedido;
window.enviarWhatsAppEntregador = Orders.enviarWhatsAppEntregador;

window.carregarHistorico = History.carregarHistorico;
window.filtrarHistorico = History.filtrarHistorico;

window.carregarConfiguracoes = Settings.carregarConfiguracoes;
window.salvarConfiguracoesGerais = Settings.salvarConfiguracoesGerais;
window.adicionarCategoriaLista = Settings.adicionarCategoriaLista;
window.removerCategoria = Settings.removerCategoria;
window.salvarOrdemCategorias = Settings.salvarOrdemCategorias;

window.carregarCupons = Coupons.carregarCupons;
window.salvarCupom = Coupons.salvarCupom;
window.deletarCupom = Coupons.deletarCupom;

window.gerarRelatorio = Reports.gerarRelatorio;

// === INICIALIZAÇÃO E EVENTOS ===
document.addEventListener('DOMContentLoaded', () => {
    Auth.verificarSessao();
    
    document.getElementById('modal-detalhes').addEventListener('click', (e) => {
        if(e.target.id === 'modal-detalhes') Orders.fecharModalDetalhes();
    });
});

window.addEventListener('auth-success', () => {
    Orders.iniciarMonitor();
    Status.carregarStatusInicial();
    Products.atualizarSelectCategorias();
});