/* ================================================= */
/* FICHEIRO: js/admin_modules/navigation.js          */
/* Controlo de navegação do Painel Admin             */
/* ================================================= */

import { state } from './state.js';
import { carregarProdutos, cancelarEdicao, atualizarSelectCategorias } from './products.js';
import { carregarHistorico } from './history.js';
import { carregarPedidosDoBanco } from './orders.js';
import { carregarConfiguracoes } from './settings.js';
import { carregarCupons } from './coupons.js';

export function nav(id, modoEdicao = false) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
    
    const section = document.getElementById(id);
    if(section) section.classList.add('active');

    const menuItem = document.querySelector(`.menu-item[onclick="nav('${id}')"]`);
    if (menuItem) menuItem.classList.add('active');
    
    if(id === 'produtos') carregarProdutos();
    if(id === 'historico') carregarHistorico();
    if(id === 'monitor') carregarPedidosDoBanco();
    if(id === 'config') carregarConfiguracoes();
    if(id === 'cupons') carregarCupons();
    
    if(id === 'novo') {
        if(!modoEdicao && state.produtoEmEdicaoId) cancelarEdicao();
        atualizarSelectCategorias(); 
    }

    if (window.innerWidth <= 768) {
        document.getElementById('sidebar').classList.remove('collapsed');
    }
}

export function toggleMenu() {
    document.getElementById('sidebar').classList.toggle('collapsed');
}