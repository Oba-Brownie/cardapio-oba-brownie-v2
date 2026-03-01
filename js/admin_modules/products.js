/* ARQUIVO: js/admin_modules/products.js */
import { supabase } from '../config/supabase-config.js';

// ==========================================
// VARIAVEIS GLOBAIS DO CORTADOR DE IMAGEM
// ==========================================
let cropperInstance = null;
let currentFile = null; 
window.croppedBlob = null; 

// Expõe as funções para os botões do HTML (admin.html)
window.cancelarCorte = cancelarCorte;
window.confirmarCorte = confirmarCorte;

// --- FUNÇÕES DE APOIO DO CORTADOR ---
export function cancelarCorte() {
    const modalCropper = document.getElementById('modal-cropper');
    if(modalCropper) modalCropper.style.display = 'none';
    if (cropperInstance) cropperInstance.destroy();
    document.getElementById('p-foto').value = ''; // Limpa o input
    currentFile = null;
    window.croppedBlob = null;
}

export function confirmarCorte() {
    if (!cropperInstance) return;

    // Obtém o canvas do recorte com qualidade 800x800px
    const canvas = cropperInstance.getCroppedCanvas({
        width: 800,
        height: 800,
        fillColor: '#fff', // Fundo branco se houver transparência
    });

    // Converte o canvas para um Blob de imagem WebP (ótima compactação)
    canvas.toBlob((blob) => {
        window.croppedBlob = blob; // Salva o arquivo cortado
        
        // Atualiza a prévia da imagem no formulário
        const previewUrl = URL.createObjectURL(blob);
        const previewImg = document.getElementById('preview-img');
        previewImg.src = previewUrl;
        previewImg.style.display = 'block';
        
        // Fecha o modal do cortador
        const modalCropper = document.getElementById('modal-cropper');
        if(modalCropper) modalCropper.style.display = 'none';
        if (cropperInstance) cropperInstance.destroy();
    }, 'image/webp', 0.8);
}


// --- NOVA FUNÇÃO DE SELEÇÃO DE ARQUIVO (ACIONA O CORTADOR) ---
export function mostrarPreview(input) {
    const file = input.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return alert('Por favor, selecione um arquivo de imagem válido.');

    currentFile = file;
    const modalCropper = document.getElementById('modal-cropper');
    const imageToCrop = document.getElementById('image-to-crop');

    // Cria URL temporária para carregar no cortador
    const reader = new FileReader();
    reader.onload = function(e) {
        imageToCrop.src = e.target.result;
        modalCropper.style.display = 'flex';

        // Inicializa o Cropper.js
        if (cropperInstance) cropperInstance.destroy(); 
        
        cropperInstance = new Cropper(imageToCrop, {
            aspectRatio: 1, // FORÇA IMAGEM QUADRADA (1:1)
            viewMode: 1, 
            dragMode: 'move', 
            guides: true, 
            highlight: false, 
            cropBoxMovable: true, 
            cropBoxResizable: true, 
            background: true, 
        });
    };
    reader.readAsDataURL(file);
}


// --- GESTÃO DE PRODUTOS ---
export function toggleCategoriaAdmin(header) {
    const content = header.nextElementSibling;
    const icon = header.querySelector('.admin-cat-icon');
    if(content.classList.contains('hidden')) { content.classList.remove('hidden'); icon.classList.remove('closed'); } 
    else { content.classList.add('hidden'); icon.classList.add('closed'); }
}

export async function carregarProdutos() {
    const div = document.getElementById('lista-produtos');
    if(!div) return;
    div.innerHTML = '<p style="text-align:center; padding:20px; color:#666"><i class="fas fa-spinner fa-spin"></i> Atualizando estoque...</p>';
    
    const { data } = await supabase.from('produtos').select('*').order('ordem', { ascending: true });
    window.listaProdutosCache = data || []; 
    div.innerHTML = '';
    
    if(!data || data.length === 0) { div.innerHTML = '<p>Estoque vazio.</p>'; return; }

    const produtosPorCategoria = {};
    const categoriasEncontradas = [];

    data.forEach(p => {
        if (!produtosPorCategoria[p.categoria]) {
            produtosPorCategoria[p.categoria] = [];
            categoriasEncontradas.push(p.categoria);
        }
        produtosPorCategoria[p.categoria].push(p);
    });

    categoriasEncontradas.forEach(cat => {
        const groupDiv = document.createElement('div');
        groupDiv.className = 'category-group';
        const headerDiv = document.createElement('div');
        headerDiv.className = 'admin-cat-header';
        headerDiv.onclick = function() { window.toggleCategoriaAdmin(this) };
        headerDiv.innerHTML = `<h3>${cat}</h3><i class="fas fa-chevron-down admin-cat-icon"></i>`;
        groupDiv.appendChild(headerDiv);

        const contentDiv = document.createElement('div');
        contentDiv.className = 'admin-cat-content'; 

        produtosPorCategoria[cat].forEach(p => {
            const badgeDestaque = p.destaque ? '<span style="background:#fff8e1; color:#fbc02d; padding:2px 6px; border-radius:4px; font-size:0.8em; border:1px solid #fbc02d; margin-left:5px;">⭐ Destaque</span>' : '';
            const statusCor = p.ativo ? '#28a745' : '#ccc';

            // --- LÓGICA DO ALERTA DE ESTOQUE BAIXO ---
            const isEstoqueBaixo = p.estoque <= 5;
            const alertaEstoque = isEstoqueBaixo ? `<span style="color: #d32f2f; font-weight: bold; font-size: 0.85em; margin-left: 5px; background: #ffebee; padding: 2px 6px; border-radius: 4px;">⚠️ Baixo</span>` : '';
            const bordaItem = isEstoqueBaixo ? 'border: 2px solid #ff5252; background-color: #fffafb;' : '';

            const el = document.createElement('div');
            el.className = 'prod-item';
            el.style.cssText = bordaItem; 
            el.innerHTML = `
                <img src="${p.imagem || 'https://placehold.co/60'}" class="prod-img">
                <div class="prod-info">
                    <div style="font-weight:bold;">${p.nome} ${badgeDestaque}</div>
                    <div style="color:#666">Ordem: <strong>${p.ordem || 999}</strong> | Est: <strong style="${isEstoqueBaixo ? 'color:#d32f2f' : ''}">${p.estoque}</strong> ${alertaEstoque}</div>
                    <div style="color:#F86DB3">R$ ${p.preco.toFixed(2)} <span style="width:10px; height:10px; background:${statusCor}; display:inline-block; border-radius:50%; margin-left:5px;"></span></div>
                </div>
                <div class="actions">
                    <button onclick="prepararEdicao('${p.id}')" class="btn-edit"><i class="fas fa-edit"></i></button>
                    <button onclick="deletarProduto('${p.id}')" class="btn-delete"><i class="fas fa-trash"></i></button>
                </div>`;
            contentDiv.appendChild(el);
        });
        groupDiv.appendChild(contentDiv);
        div.appendChild(groupDiv);
    });
}

export function prepararEdicao(id) {
    const produto = window.listaProdutosCache.find(p => p.id == id);
    if (!produto) return;
    
    window.atualizarSelectCategorias().then(() => {
        document.getElementById('p-nome').value = produto.nome;
        document.getElementById('p-preco').value = produto.preco;
        document.getElementById('p-estoque').value = produto.estoque;
        document.getElementById('p-ordem').value = produto.ordem || 999; 
        document.getElementById('p-desc').value = produto.descricao || '';
        document.getElementById('p-categoria').value = produto.categoria;
        document.getElementById('p-ativo').checked = produto.ativo;
        document.getElementById('p-destaque').checked = produto.destaque || false;
        
        const preview = document.getElementById('preview-img');
        if (produto.imagem) { preview.src = produto.imagem; preview.style.display = 'block'; }
        else { preview.src = ''; preview.style.display = 'none'; }
        
        window.produtoEmEdicaoId = id; 
        window.urlImagemAtual = produto.imagem; 
        window.croppedBlob = null; // Reseta o corte atual
        
        document.getElementById('titulo-form').innerText = "Editar Produto";
        document.getElementById('btn-salvar').innerText = "ATUALIZAR PRODUTO";
        document.getElementById('btn-cancelar').classList.add('visible');
        document.querySelector('.form-card').classList.add('editing');
        
        window.nav('novo', true); 
    });
}

export function cancelarEdicao() {
    window.produtoEmEdicaoId = null; 
    window.urlImagemAtual = null;
    window.croppedBlob = null; 
    currentFile = null;
    
    document.getElementById('form-produto').reset();
    document.getElementById('preview-img').style.display = 'none';
    document.getElementById('titulo-form').innerText = "Cadastrar Produto";
    document.getElementById('btn-salvar').innerText = "SALVAR PRODUTO";
    document.getElementById('btn-cancelar').classList.remove('visible');
    document.querySelector('.form-card').classList.remove('editing');
}

export async function salvarProduto(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-salvar'); 
    const textoOriginal = btn.innerText;
    btn.innerText = "Processando..."; btn.disabled = true;

    try {
        const fotoInput = document.getElementById('p-foto');
        let fotoUrlFinal = window.urlImagemAtual; 
        
        // Verifica se há uma imagem recortada na memória
        if (window.croppedBlob) {
            btn.innerText = "Enviando Imagem...";
            
            const fileExt = 'webp'; // Imagem sempre vai ser webp pelo Cropper
            const nomeArquivo = `${Date.now()}-imagem.${fileExt}`;
            
            const { error: uploadError } = await supabase.storage
                .from('fotos-brownie')
                .upload(nomeArquivo, window.croppedBlob, { contentType: 'image/webp' });
                
            if (uploadError) throw uploadError;
            
            const { data: publicData } = supabase.storage
                .from('fotos-brownie')
                .getPublicUrl(nomeArquivo);
                
            fotoUrlFinal = publicData.publicUrl;
            
        } else if (fotoInput.files.length > 0) {
            // Se ele selecionou uma imagem mas por algum motivo fugiu do modal de recorte
            btn.disabled = false;
            btn.innerText = textoOriginal;
            return alert("Por favor, conclua o recorte da imagem antes de salvar.");
        }

        let ordemValor = parseInt(document.getElementById('p-ordem').value);
        if (isNaN(ordemValor)) ordemValor = 999;

        const dadosProduto = {
            nome: document.getElementById('p-nome').value,
            preco: parseFloat(document.getElementById('p-preco').value),
            categoria: document.getElementById('p-categoria').value,
            estoque: parseInt(document.getElementById('p-estoque').value),
            ordem: ordemValor,
            descricao: document.getElementById('p-desc').value,
            imagem: fotoUrlFinal, 
            ativo: document.getElementById('p-ativo').checked,
            destaque: document.getElementById('p-destaque').checked
        };

        if (window.produtoEmEdicaoId) {
            const { error } = await supabase.from('produtos').update(dadosProduto).eq('id', window.produtoEmEdicaoId);
            if (error) throw error;
            alert("Produto atualizado!");
            cancelarEdicao();
        } else {
            const { error } = await supabase.from('produtos').insert(dadosProduto);
            if (error) throw error;
            alert("Produto criado!");
            cancelarEdicao();
        }
        window.nav('produtos');
    } catch (erro) { alert("Erro: " + erro.message); } 
    finally { btn.innerText = textoOriginal; btn.disabled = false; }
}

export async function deletarProduto(id) {
    if(confirm('Apagar este produto?')) {
        await supabase.from('produtos').delete().eq('id', id);
        carregarProdutos();
    }
}

export async function atualizarSelectCategorias() {
    const select = document.getElementById('p-categoria');
    if(!select) return;

    let lista = window.categoriasCache || [];
    if(lista.length === 0) {
        const { data } = await supabase.from('config_loja').select('categorias_ordem').limit(1).single();
        if(data && data.categorias_ordem) {
            lista = data.categorias_ordem;
            window.categoriasCache = lista;
        }
    }

    select.innerHTML = '<option value="">Selecione...</option>';
    lista.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        select.appendChild(opt);
    });
}

export function filtrarProdutos(termo) {
    termo = termo.toLowerCase().trim();
    const grupos = document.querySelectorAll('.category-group');

    grupos.forEach(grupo => {
        let encontrou = false;
        const itens = grupo.querySelectorAll('.prod-item');
        itens.forEach(item => {
            const textoItem = item.innerText.toLowerCase();
            if (textoItem.includes(termo)) {
                item.style.display = 'flex'; 
                encontrou = true;
            } else {
                item.style.display = 'none'; 
            }
        });
        if (termo === '') grupo.style.display = 'block';
        else grupo.style.display = encontrou ? 'block' : 'none';
    });
}