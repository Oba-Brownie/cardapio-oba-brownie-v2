/* ================================================= */
/* FICHEIRO: js/admin_modules/auth.js                */
/* Autenticação e Controlo de Sessão                 */
/* ================================================= */

import { supabase } from '../config/supabase-config.js';
import { LOCAL_TEST_MODE } from '../modules/local_test_mode.js';

// === CONTROLO DE SESSÃO ===
export async function verificarSessao() {
    document.getElementById('admin-content').style.display = 'none';

    if (LOCAL_TEST_MODE) {
        liberarPainel();
        return;
    }

    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        bloquearPainel();
        return;
    }

    const { data: isAdmin, error } = await supabase.rpc('is_admin');
    if (!error && isAdmin === true) liberarPainel();
    else bloquearPainel();
}

export async function login() {
    if (LOCAL_TEST_MODE) {
        liberarPainel();
        return;
    }

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
        const { data: isAdmin, error: permissionError } = await supabase.rpc('is_admin');
        if (permissionError || isAdmin !== true) {
            await supabase.auth.signOut();
            bloquearPainel();
            msg.innerText = 'Esta conta não tem permissão para acessar o painel.';
            btn.innerText = "ENTRAR";
            btn.disabled = false;
            return;
        }

        msg.innerText = "";
        liberarPainel();
    }
}

export async function logout() {
    if (LOCAL_TEST_MODE) {
        window.location.reload();
        return;
    }

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
