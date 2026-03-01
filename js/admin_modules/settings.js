/* ARQUIVO: js/admin_modules/settings.js */
import { supabase } from '../config/supabase-config.js';

export async function carregarConfiguracoes() {
    const { data } = await supabase.from('config_loja').select('*').limit(1).single();
    if (data) {
        document.getElementById('conf-msg-fechado').value = data.mensagem_fechado || "";
        document.getElementById('conf-pix').value = data.chave_pix || "";

        window.categoriasCache = data.categorias_ordem || [];
        renderizarListaCategoriasConfig();
    }
}

export async function salvarConfiguracoesGerais() {
    const btn = document.getElementById('btn-salvar-config');
    const textoOriginal = btn.innerText;
    btn.innerText = "Salvando...";
    btn.disabled = true;

    try {
        const msg = document.getElementById('conf-msg-fechado').value;
        const pix = document.getElementById('conf-pix').value;

        const { data: config } = await supabase.from('config_loja').select('id').limit(1).single();
        
        await supabase.from('config_loja').update({ 
            mensagem_fechado: msg, 
            chave_pix: pix 
            // qr_code_pix não é mais atualizado
        }).eq('id', config.id);
        
        alert("Configurações salvas com sucesso!");
    } catch (erro) {
        console.error("Erro ao salvar config:", erro);
        alert("Erro ao salvar: " + erro.message);
    } finally {
        btn.innerText = textoOriginal;
        btn.disabled = false;
    }
}

export function renderizarListaCategoriasConfig() {
    const div = document.getElementById('lista-categorias-config');
    if(!div) return;
    div.innerHTML = '';

    if (!window.categoriasCache || window.categoriasCache.length === 0) {
        div.innerHTML = '<p style="padding:10px; color:#999; text-align:center">Nenhuma categoria cadastrada.</p>';
        return;
    }

    window.categoriasCache.forEach((cat, index) => {
        const item = document.createElement('div');
        item.className = 'cat-sortable-item'; 
        item.dataset.nome = cat; 
        item.innerHTML = `
            <div style="display:flex; align-items:center; flex:1">
                <i class="fas fa-grip-lines drag-handle" title="Segure e arraste"></i>
                <span style="font-weight:bold; color:#333;">${cat}</span>
            </div>
            <button onclick="removerCategoria(${index})" style="cursor:pointer; border:none; background:#ffebee; color:red; padding:8px 12px; border-radius:5px; transition:0.2s">
                <i class="fas fa-trash"></i>
            </button>
        `;
        div.appendChild(item);
    });
    iniciarSortable();
}

function iniciarSortable() {
    const el = document.getElementById('lista-categorias-config');
    if (!el) return;
    if (typeof Sortable === 'undefined') { console.warn("SortableJS não carregada."); return; }

    if (!el.sortableInstance) {
        el.sortableInstance = Sortable.create(el, {
            handle: '.drag-handle',
            animation: 150,
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            onEnd: function (evt) {
                const novaOrdem = [];
                const itens = el.querySelectorAll('.cat-sortable-item');
                itens.forEach(item => { novaOrdem.push(item.dataset.nome); });
                window.categoriasCache = novaOrdem;
            }
        });
    }
}

export function adicionarCategoriaLista() {
    const input = document.getElementById('nova-cat-nome');
    const nome = input.value.trim();
    if (!nome) return alert("Digite um nome!");
    
    window.categoriasCache = window.categoriasCache || [];
    
    if (!window.categoriasCache.includes(nome)) {
        window.categoriasCache.push(nome);
        renderizarListaCategoriasConfig();
        input.value = '';
    } else {
        alert("Essa categoria já existe na lista.");
    }
}

export function removerCategoria(index) {
    if(confirm("Remover esta categoria?")) {
        window.categoriasCache.splice(index, 1);
        renderizarListaCategoriasConfig();
    }
}

export async function salvarOrdemCategorias() {
    const { data: config } = await supabase.from('config_loja').select('id').limit(1).single();
    await supabase.from('config_loja').update({ categorias_ordem: window.categoriasCache }).eq('id', config.id);
    if(typeof window.atualizarSelectCategorias === 'function') {
        await window.atualizarSelectCategorias(); 
    }
    alert("Ordem atualizada!");
}