/* ================================================= */
/* ARQUIVO: js/admin_modules/products.js             */
/* Gerenciamento de Produtos, Upload (Supabase Storage) e Galeria */
/* ================================================= */

import { supabase } from '../config/supabase-config.js';

let cropperInstance = null;
let currentFile = null; 
window.croppedBlob = null; 

window.cancelarCorte = cancelarCorte;
window.confirmarCorte = confirmarCorte;
window.abrirGaleria = abrirGaleria;
window.fecharGaleria = fecharGaleria;
window.selecionarImagemGaleria = selecionarImagemGaleria;
window.deletarImagemGaleria = deletarImagemGaleria;

// === CORTADOR DE IMAGENS ===
export function cancelarCorte() {
    const modalCropper = document.getElementById('modal-cropper');
    if (modalCropper) modalCropper.style.display = 'none';
    if (cropperInstance) cropperInstance.destroy();
    document.getElementById('p-foto').value = ''; 
    currentFile = null;
    window.croppedBlob = null;
}

export function confirmarCorte() {
    if (!cropperInstance) return;

    // MELHORIA DE QUALIDADE (Resolução de 1080x1080)
    const canvas = cropperInstance.getCroppedCanvas({
        width: 1080, 
        height: 1080,
        fillColor: '#fff',
    });

    // MELHORIA DE QUALIDADE (0.95 de qualidade em formato ultra-leve WebP)
    canvas.toBlob((blob) => {
        window.croppedBlob = blob;
        
        const previewUrl = URL.createObjectURL(blob);
        const previewImg = document.getElementById('preview-img');
        previewImg.src = previewUrl;
        previewImg.style.display = 'block';
        
        const modalCropper = document.getElementById('modal-cropper');
        if (modalCropper) modalCropper.style.display = 'none';
        if (cropperInstance) cropperInstance.destroy();
    }, 'image/webp', 0.95); 
}

export function mostrarPreview(input) {
    const file = input.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return alert('Selecione um arquivo de imagem válido.');

    currentFile = file;
    const modalCropper = document.getElementById('modal-cropper');
    const imageToCrop = document.getElementById('image-to-crop');

    const reader = new FileReader();
    reader.onload = function(e) {
        imageToCrop.src = e.target.result;
        modalCropper.style.display = 'flex';

        if (cropperInstance) cropperInstance.destroy(); 
        
        cropperInstance = new Cropper(imageToCrop, {
            aspectRatio: 1, 
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

// === LISTAGEM E RENDERIZAÇÃO ===
export function toggleCategoriaAdmin(header) {
    const content = header.nextElementSibling;
    const icon = header.querySelector('.admin-cat-icon');
    if(content.classList.contains('hidden')) { 
        content.classList.remove('hidden'); 
        icon.classList.remove('closed'); 
    } else { 
        content.classList.add('hidden'); 
        icon.classList.add('closed'); 
    }
}

export async function carregarProdutos() {
    const div = document.getElementById('lista-produtos');
    if(!div) return;
    div.innerHTML = '<p style="text-align:center; padding:20px; color:#666"><i class="fas fa-spinner fa-spin"></i> Atualizando estoque...</p>';
    
    const { data } = await supabase.from('produtos').select('id, nome, preco, preco_original, estoque, ordem, categoria, ativo, destaque, imagem, descricao').order('ordem', { ascending: true });
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

            const isEstoqueBaixo = p.estoque <= 5;
            const alertaEstoque = isEstoqueBaixo ? `<span style="color: #d32f2f; font-weight: bold; font-size: 0.85em; margin-left: 5px; background: #ffebee; padding: 2px 6px; border-radius: 4px;">⚠️ Baixo</span>` : '';
            const bordaItem = isEstoqueBaixo ? 'border: 2px solid #ff5252; background-color: #fffafb;' : '';

            const el = document.createElement('div');
            el.className = 'prod-item';
            el.style.cssText = bordaItem; 
            el.innerHTML = `
                <img src="${p.imagem || 'https://placehold.co/60'}" class="prod-img" loading="lazy">
                <div class="prod-info">
                    <div style="font-weight:bold;">${p.nome} ${badgeDestaque}</div>
                    <div style="color:#666">Ordem: <strong>${p.ordem || 999}</strong> | Est: <strong style="${isEstoqueBaixo ? 'color:#d32f2f' : ''}">${p.estoque}</strong> ${alertaEstoque}</div>
                    <div style="color:#F86DB3">
                        ${p.preco_original ? `<span style="text-decoration:line-through; color:#999; font-size:0.85em; margin-right:5px;">R$ ${p.preco_original.toFixed(2)}</span>` : ''}
                        R$ ${p.preco.toFixed(2)} 
                        <span style="width:10px; height:10px; background:${statusCor}; display:inline-block; border-radius:50%; margin-left:5px;"></span>
                    </div>
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

// === CADASTRO E EDIÇÃO ===
export function prepararEdicao(id) {
    const produto = window.listaProdutosCache.find(p => p.id == id);
    if (!produto) return;
    
    window.atualizarSelectCategorias().then(() => {
        document.getElementById('p-nome').value = produto.nome;
        document.getElementById('p-preco').value = produto.preco;
        document.getElementById('p-preco-original').value = produto.preco_original || ''; 
        document.getElementById('p-estoque').value = produto.estoque;
        document.getElementById('p-ordem').value = produto.ordem || 999; 
        document.getElementById('p-desc').value = produto.descricao || '';
        document.getElementById('p-categoria').value = produto.categoria;
        document.getElementById('p-ativo').checked = produto.ativo;
        document.getElementById('p-destaque').checked = produto.destaque || false;
        
        const urlInput = document.getElementById('p-foto-url');
        if (urlInput) urlInput.value = '';

        const preview = document.getElementById('preview-img');
        if (produto.imagem) { preview.src = produto.imagem; preview.style.display = 'block'; }
        else { preview.src = ''; preview.style.display = 'none'; }
        
        window.produtoEmEdicaoId = id; 
        window.urlImagemAtual = produto.imagem; 
        window.croppedBlob = null; 
        
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
    
    const urlInput = document.getElementById('p-foto-url');
    if (urlInput) urlInput.value = '';

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
        const urlInput = document.getElementById('p-foto-url'); 
        
        let fotoUrlFinal = window.urlImagemAtual; 
        
        // PRIORIDADE 1: Se ela colou um link ou selecionou da Galeria
        if (urlInput && urlInput.value.trim() !== '') {
            fotoUrlFinal = urlInput.value.trim();
        } 
        // PRIORIDADE 2: Upload para o ImgBB (com compressão WebP!)
        else if (window.croppedBlob) {
            btn.innerText = "Enviando para o ImgBB...";
            
            // A chave da API do ImgBB do seu projeto
            const apiKey = '51c759a4e8edeca1edb1d902d8e2c27a'; 
            
            // Prepara o "pacote" com a foto recortada
            const formData = new FormData();
            formData.append('image', window.croppedBlob, `brownie_${Date.now()}.webp`);
            
            // Dispara para os servidores do ImgBB
            const resposta = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
                method: 'POST',
                body: formData
            });
            
            const dados = await resposta.json();
            
            if (dados.success) {
                fotoUrlFinal = dados.data.url; // Pega o link público gerado
            } else {
                throw new Error("Falha ao salvar a imagem no ImgBB: " + (dados.error?.message || "Erro desconhecido"));
            }
            
        } 
        // TRATAMENTO DE ERRO: Se ela escolheu um arquivo mas não cortou
        else if (fotoInput && fotoInput.files.length > 0) {
            btn.disabled = false;
            btn.innerText = textoOriginal;
            return alert("Por favor, conclua o recorte da imagem antes de salvar.");
        }

        let ordemValor = parseInt(document.getElementById('p-ordem').value);
        if (isNaN(ordemValor)) ordemValor = 999;
        
        let precoAntigo = document.getElementById('p-preco-original').value;
        precoAntigo = precoAntigo ? parseFloat(precoAntigo) : null;

        const dadosProduto = {
            nome: document.getElementById('p-nome').value,
            preco: parseFloat(document.getElementById('p-preco').value),
            preco_original: precoAntigo, 
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
        } else {
            const { error } = await supabase.from('produtos').insert(dadosProduto);
            if (error) throw error;
            alert("Produto criado!");
        }
        cancelarEdicao();
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
    if (!select) return;

    let listaConfig = window.categoriasCache || [];
    if (listaConfig.length === 0) {
        const { data } = await supabase.from('config_loja').select('categorias_ordem').limit(1).single();
        if (data && data.categorias_ordem) {
            listaConfig = data.categorias_ordem;
            window.categoriasCache = listaConfig;
        }
    }

    let categoriasDosProdutos = [];
    if (window.listaProdutosCache && window.listaProdutosCache.length > 0) {
        categoriasDosProdutos = window.listaProdutosCache.map(p => p.categoria).filter(c => c);
    }

    const listaFinal = [...new Set([...listaConfig, ...categoriasDosProdutos])];

    select.innerHTML = '<option value="">Selecione...</option>';
    listaFinal.forEach(cat => {
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


// =========================================================
// === GALERIA DE IMAGENS INTERNA (COM EXCLUSÃO FÍSICA) ===
// =========================================================

export async function abrirGaleria() {
    const grid = document.getElementById('grid-galeria');
    const modal = document.getElementById('modal-galeria');
    
    grid.innerHTML = '<p style="grid-column: 1/-1; text-align:center; color:#666;"><i class="fas fa-spinner fa-spin"></i> Carregando suas fotos...</p>';
    modal.style.display = 'flex';

    try {
        const { data } = await supabase.from('produtos').select('imagem').not('imagem', 'is', null);
        
        if (!data || data.length === 0) {
            grid.innerHTML = '<p style="grid-column: 1/-1; text-align:center;">Nenhuma imagem encontrada no sistema.</p>';
            return;
        }

        const urlsUnicas = [...new Set(data.map(p => p.imagem).filter(url => url && url.startsWith('http')))];

        grid.innerHTML = '';
        urlsUnicas.forEach(url => {
            const wrapper = document.createElement('div');
            wrapper.style.cssText = 'position: relative; width: 100%; height: 110px; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 5px rgba(0,0,0,0.1); border: 3px solid transparent; transition: all 0.2s;';
            wrapper.onmouseover = () => { wrapper.style.borderColor = 'var(--primary)'; wrapper.style.transform = 'scale(1.05)'; };
            wrapper.onmouseout = () => { wrapper.style.borderColor = 'transparent'; wrapper.style.transform = 'scale(1)'; };

            const img = document.createElement('img');
            img.src = url;
            img.style.cssText = 'width: 100%; height: 100%; object-fit: cover; cursor: pointer;';
            img.onclick = () => selecionarImagemGaleria(url);

            const btnDel = document.createElement('button');
            btnDel.innerHTML = '<i class="fas fa-trash"></i>';
            btnDel.title = "Apagar Imagem";
            btnDel.style.cssText = 'position: absolute; top: 5px; right: 5px; background: rgba(220, 53, 69, 0.9); color: white; border: none; border-radius: 50%; width: 28px; height: 28px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.8em; box-shadow: 0 2px 4px rgba(0,0,0,0.3);';
            
            btnDel.onclick = (e) => {
                e.stopPropagation(); 
                deletarImagemGaleria(url);
            };

            wrapper.appendChild(img);
            wrapper.appendChild(btnDel);
            grid.appendChild(wrapper);
        });
        
        if(urlsUnicas.length === 0) {
            grid.innerHTML = '<p style="grid-column: 1/-1; text-align:center;">Nenhuma imagem válida encontrada.</p>';
        }

    } catch (e) {
        grid.innerHTML = '<p style="grid-column: 1/-1; text-align:center; color:red;">Erro ao carregar a galeria.</p>';
        console.error(e);
    }
}

export function fecharGaleria() {
    const modal = document.getElementById('modal-galeria');
    if (modal) modal.style.display = 'none';
}

export function selecionarImagemGaleria(url) {
    document.getElementById('p-foto-url').value = url;
    const preview = document.getElementById('preview-img');
    preview.src = url;
    preview.style.display = 'block';
    
    document.getElementById('p-foto').value = '';
    window.croppedBlob = null; 
    
    fecharGaleria();
}

export async function deletarImagemGaleria(url) {
    if(confirm('🚨 Tem certeza que deseja apagar esta imagem?\n\nEla será removida da galeria, de todos os produtos, e o arquivo físico será apagado do servidor permanentemente.')) {
        try {
            // 1. Tira a foto de todos os produtos que usam esse link no Banco de Dados
            const { error: dbError } = await supabase.from('produtos').update({ imagem: null }).eq('imagem', url);
            if (dbError) throw dbError;
            
            // 2. NOVO: Se a imagem estiver no nosso Supabase Storage, apaga o arquivo físico!
            if (url.includes('supabase.co/storage/v1/object/public/produtos/')) {
                // Pega apenas o nome do arquivo final (ex: brownie_1711982736.webp)
                const nomeArquivo = url.split('/').pop(); 
                
                const { error: storageError } = await supabase.storage.from('produtos').remove([nomeArquivo]);
                if (storageError) console.error("Erro ao apagar arquivo físico:", storageError);
            }
            
            abrirGaleria();
            carregarProdutos();
            
            alert('Imagem apagada com sucesso e espaço libertado no servidor!');
        } catch (e) {
            alert('Erro ao apagar imagem: ' + e.message);
        }
    }
}