/* ================================================= */
/* ARQUIVO: js/admin_modules/status.js               */
/* Controle de Status da Loja (Aberta/Fechada)       */
/* ================================================= */

import { supabase } from '../config/supabase-config.js';
import { state } from './state.js';

function atualizarBotaoStatus(estaAberta) {
    const btn = document.getElementById('btn-status-toggle');
    if (!btn) return;
    
    state.lojaEstaAberta = estaAberta;
    
    if (estaAberta) {
        btn.innerHTML = "LOJA ABERTA"; 
        btn.className = "btn-status-on";
    } else {
        btn.innerHTML = "LOJA FECHADA"; 
        btn.className = "btn-status-off";
    }
}

export async function carregarStatusInicial() {
    const btn = document.getElementById('btn-status-toggle');
    if (!btn) return;
    
    const { data } = await supabase.from('config_loja').select('loja_aberta').limit(1).single();
    atualizarBotaoStatus(data ? data.loja_aberta : false);
}

export async function toggleLojaStatus() {
    const btn = document.getElementById('btn-status-toggle');
    const novoStatus = !state.lojaEstaAberta;
    
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    btn.className = "btn-status-loading";
    btn.disabled = true;

    try {
        const { data: config } = await supabase.from('config_loja').select('id').limit(1).single();
        if (!config) {
            await supabase.from('config_loja').insert([{ loja_aberta: novoStatus }]);
        } else {
            await supabase.from('config_loja').update({ loja_aberta: novoStatus }).eq('id', config.id);
        }
        atualizarBotaoStatus(novoStatus);
    } catch (error) {
        console.error("Erro status:", error);
        atualizarBotaoStatus(state.lojaEstaAberta); 
    } finally {
        btn.disabled = false;
    }
}