/* ARQUIVO: js/admin_modules/auth.js */
import { supabase } from '../config/supabase-config.js';

export async function verificarSessao() {
    // Esconde o painel até saber se está logado
    document.getElementById('admin-content').style.display = 'none';
    
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
        liberarPainel();
    } else {
        bloquearPainel();
    }
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

    const { data, error } = await supabase.auth.signInWithPassword({ 
        email: email, 
        password: pass 
    });

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

function liberarPainel() {
    document.getElementById('login-screen').style.display = 'none';
    
    // A MÁGICA ACONTECE AQUI: Força o estilo flex para restaurar o formato original
    document.getElementById('admin-content').style.display = 'flex'; 
    
    // Avisa o painel que ele já pode carregar os dados do banco
    window.dispatchEvent(new Event('auth-success'));
}

function bloquearPainel() {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('admin-content').style.display = 'none';
}
