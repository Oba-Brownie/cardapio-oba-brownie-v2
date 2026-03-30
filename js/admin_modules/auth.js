/* ================================================= */
/* FICHEIRO: js/admin_modules/auth.js                */
/* Autenticação e Controlo de Sessão                 */
/* ================================================= */

import { supabase } from '../config/supabase-config.js';

// === CONTROLO DE SESSÃO ===
export async function verificarSessao() {
    document.getElementById('admin-content').style.display = 'none';
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) liberarPainel();
    else bloquearPainel();
}

export async function login() {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;
    const msg = document.getElementById('login-msg');
    const btn = document.getElementById('btn-login');

    if (!email || !pass) { 
        msg.innerText = 'Preencha e-mail e senha.'; 
        return; 
    }

    btn.innerText = "Aguarde...";
    btn.disabled = true;

    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });

    if (error) {
        msg.innerText = "Erro: E-mail ou senha incorretos.";
        btn.innerText = "ENTRAR";
        btn.disabled = false;
    } else {
        msg.innerText = "";
        liberarPainel();
    }
}

export async function logout() {
    await supabase.auth.signOut();
    window.location.reload();
}

// === MANIPULAÇÃO DE INTERFACE ===
function liberarPainel() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('admin-content').style.display = 'flex'; 
    window.dispatchEvent(new Event('auth-success'));
}

function bloquearPainel() {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('admin-content').style.display = 'none';
}