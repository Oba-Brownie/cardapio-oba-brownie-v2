/* ================================================= */
/* ARQUIVO: js/admin_modules/products.js             */
/* Gerenciamento de Produtos, Upload (Cloudinary) e Galeria */
/* ================================================= */

import { supabase } from '../config/supabase-config.js';
import { attachImageFallbacks, DEFAULT_IMAGE_FALLBACK, escapeHTML, escapeAttribute, formatCurrencyBR, inlineJSString, safeNumber, sanitizeImageUrl, validateImageUrl } from '../modules/utils.js';
import { LOCAL_TEST_MODE, getMockConfigLoja, getMockProductsAdmin, showLocalMutationBlocked } from '../modules/local_test_mode.js';

let cropperInstance = null;
let currentFile = null; 
window.croppedBlob = null; 

const CLOUDINARY_CONFIG = {
    cloudName: 'hhoqdvcp',
    uploadPreset: 'oba_brownie',
    folder: 'produtos'
};

const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`;

function criarSlugCloudinary(valor, fallback = 'produto') {
    return String(valor || fallback)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80) || fallback;
}
window.cancelarCorte = cancelarCorte;
window.confirmarCorte = confirmarCorte;
window.abrirGaleria = abrirGaleria;
window.fecharGaleria = fecharGaleria;
window.selecionarImagemGaleria = selecionarImagemGaleria;
window.deletarImagemGaleria = deletarImagemGaleria;
window.testarImagemProduto = testarImagemProduto;

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

export async function testarImagemProduto() {
    const urlInput = document.getElementById('p-foto-url');
    const preview = document.getElementById('preview-img');
    const url = urlInput ? urlInput.value.trim() : '';

    if (!url) {
        alert('Cole uma URL de imagem antes de testar.');
        return;
    }

    const carrega = await validateImageUrl(url);
    if (!carrega) {
        alert('A imagem não carregou. Use um link direto de imagem, de preferência começando com https://res.cloudinary.com/.');
        return;
    }

    if (preview) {
        preview.dataset.fallbackSrc = DEFAULT_IMAGE_FALLBACK;
        attachImageFallbacks(preview.parentElement || document);
        preview.src = sanitizeImageUrl(url);
        preview.style.display = 'block';
    }
    alert('Imagem carregou corretamente.');
}

async function uploadImagemProdutoCloudinary(blob, nomeProduto, categoriaProduto) {
    const produtoSlug = criarSlugCloudinary(nomeProduto, 'produto');
    const categoriaSlug = criarSlugCloudinary(categoriaProduto, 'sem-categoria');
    const dataUpload = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
    const publicId = `${produtoSlug}-${dataUpload}`;

    const formData = new FormData();
    formData.append('file', blob, `${publicId}.webp`);
    formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
    const assetFolder = `${CLOUDINARY_CONFIG.folder}/${categoriaSlug}`;
    formData.append('asset_folder', assetFolder);
    formData.append('public_id_prefix', assetFolder);
    formData.append('public_id', publicId);

    const resposta = await fetch(CLOUDINARY_UPLOAD_URL, {
        method: 'POST',
        body: formData
    });

    let dados = null;
    try {
        dados = await resposta.json();
    } catch {
        throw new Error('O Cloudinary retornou uma resposta inválida. Tente reenviar a foto.');
    }

    if (!resposta.ok || !dados.secure_url) {
        throw new Error('Falha ao salvar a imagem no Cloudinary: ' + (dados?.error?.message || 'Erro desconhecido'));
    }

    return dados.secure_url;
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
    
    const data = LOCAL_TEST_MODE
        ? getMockProductsAdmin()
        : (await supabase.from('produtos').select('id, nome, preco, preco_original, estoque, ordem, categoria, ativo, destaque, imagem, descricao').order('ordem', { ascending: true })).data;
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
        const safeCategory = escapeHTML(cat || 'Sem categoria');
        
        const headerDiv = document.createElement('div');
        headerDiv.className = 'admin-cat-header';
        headerDiv.onclick = function() { window.toggleCategoriaAdmin(this) };
        headerDiv.innerHTML = `<h3>${safeCategory}</h3><i class="fas fa-chevron-down admin-cat-icon"></i>`;
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
            const productId = inlineJSString(p.id);
            const productImage = escapeAttribute(sanitizeImageUrl(p.imagem, 'https://placehold.co/60'));
            const productName = escapeHTML(p.nome);
            const productOrder = escapeHTML(p.ordem || 999);
            const productStock = safeNumber(p.estoque);
            const productPrice = formatCurrencyBR(p.preco);
            const originalPrice = p.preco_original ? `<span style="text-decoration:line-through; color:#999; font-size:0.85em; margin-right:5px;">R$ ${formatCurrencyBR(p.preco_original)}</span>` : '';
            el.innerHTML = `
                <img src="${productImage}" class="prod-img" loading="lazy" decoding="async" data-fallback-src="https://placehold.co/60">
                <div class="prod-info">
                    <div style="font-weight:bold;">${productName} ${badgeDestaque}</div>
                    <div style="color:#666">Ordem: <strong>${productOrder}</strong> | Est: <strong style="${isEstoqueBaixo ? 'color:#d32f2f' : ''}">${productStock}</strong> ${alertaEstoque}</div>
                    <div style="color:#F86DB3">
                        ${originalPrice}
                        R$ ${productPrice}
                        <span style="width:10px; height:10px; background:${statusCor}; display:inline-block; border-radius:50%; margin-left:5px;"></span>
                    </div>
                </div>
                <div class="actions">
                    <button onclick="prepararEdicao(${productId})" class="btn-edit"><i class="fas fa-edit"></i></button>
                    <button onclick="deletarProduto(${productId})" class="btn-delete"><i class="fas fa-trash"></i></button>
                </div>`;
            attachImageFallbacks(el, 'https://placehold.co/60');
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
        if (produto.imagem) {
            preview.dataset.fallbackSrc = DEFAULT_IMAGE_FALLBACK;
            attachImageFallbacks(preview.parentElement || document);
            preview.src = produto.imagem;
            preview.style.display = 'block';
        }
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

    if (LOCAL_TEST_MODE) {
        showLocalMutationBlocked('Salvar produto ou enviar imagem');
        return;
    }

    const btn = document.getElementById('btn-salvar'); 
    const textoOriginal = btn.innerText;
    btn.innerText = "Processando..."; btn.disabled = true;

    try {
        const fotoInput = document.getElementById('p-foto');
        const urlInput = document.getElementById('p-foto-url'); 
        const nomeProduto = document.getElementById('p-nome').value.trim();
        const categoriaProduto = document.getElementById('p-categoria').value.trim();
        
        let fotoUrlFinal = window.urlImagemAtual; 
        
        // PRIORIDADE 1: Se ela colou um link ou selecionou da Galeria
        const imagemColadaManual = urlInput && urlInput.value.trim() !== '';

        if (imagemColadaManual) {
            fotoUrlFinal = urlInput.value.trim();
        }
        // PRIORIDADE 2: Upload para o Cloudinary (com compressão WebP!)
        else if (window.croppedBlob) {
            btn.innerText = "Enviando para o Cloudinary...";

            fotoUrlFinal = await uploadImagemProdutoCloudinary(window.croppedBlob, nomeProduto, categoriaProduto);
            const imagemCarrega = await validateImageUrl(fotoUrlFinal);
            if (!imagemCarrega) {
                throw new Error("O Cloudinary respondeu, mas a imagem gerada não carregou no navegador. Tente reenviar a foto.");
            }
            
        } 
        // TRATAMENTO DE ERRO: Se ela escolheu um arquivo mas não cortou
        else if (fotoInput && fotoInput.files.length > 0) {
            btn.disabled = false;
            btn.innerText = textoOriginal;
            return alert("Por favor, conclua o recorte da imagem antes de salvar.");
        }

        if (imagemColadaManual) {
            const imagemCarrega = await validateImageUrl(fotoUrlFinal);
            if (!imagemCarrega) {
                btn.disabled = false;
                btn.innerText = textoOriginal;
                return alert("A URL da imagem não carregou. Confira se é um link direto de imagem, de preferência começando com https://res.cloudinary.com/.");
            }
        }

        let ordemValor = parseInt(document.getElementById('p-ordem').value);
        if (isNaN(ordemValor)) ordemValor = 999;
        
        let precoAntigo = document.getElementById('p-preco-original').value;
        precoAntigo = precoAntigo ? parseFloat(precoAntigo) : null;

        const dadosProduto = {
            nome: nomeProduto,
            preco: parseFloat(document.getElementById('p-preco').value),
            preco_original: precoAntigo, 
            categoria: categoriaProduto,
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
    if (LOCAL_TEST_MODE) {
        showLocalMutationBlocked('Exclusao de produto');
        return;
    }

    if(confirm('Apagar este produto?')) {
        await supabase.from('produtos').delete().eq('id', id);
        carregarProdutos();
    }
}

export async function atualizarSelectCategorias() {
    const select = document.getElementById('p-categoria');
    if (!select) return;

    let listaConfig = window.categoriasCache || [];
    if (LOCAL_TEST_MODE) {
        listaConfig = getMockConfigLoja().categoriasOrdem || [];
        window.categoriasCache = listaConfig;
    } else if (listaConfig.length === 0) {
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
// === GALERIA DE IMAGENS INTERNA ===
// =========================================================

export async function abrirGaleria() {
    const grid = document.getElementById('grid-galeria');
    const modal = document.getElementById('modal-galeria');
    if (!grid || !modal) return;

    configurarEventosGaleria();
    grid.innerHTML = '<div class="galeria-loading"><i class="fas fa-spinner fa-spin"></i><span>Carregando imagens dos produtos...</span></div>';
    modal.style.display = 'flex';

    try {
        let data = [];
        if (LOCAL_TEST_MODE) {
            data = getMockProductsAdmin().map(p => ({ id: p.id, nome: p.nome, categoria: p.categoria, ativo: p.ativo, imagem: p.imagem }));
        } else {
            const { data: produtosGaleria, error } = await supabase
                .from('produtos')
                .select('id, nome, categoria, ativo, imagem')
                .not('imagem', 'is', null)
                .order('categoria', { ascending: true })
                .order('nome', { ascending: true });

            if (error) throw error;
            data = produtosGaleria || [];
        }

        window.galeriaImagensCache = prepararItensGaleria(data);
        atualizarCategoriasGaleria(window.galeriaImagensCache);
        atualizarResumoGaleria(window.galeriaImagensCache);
        renderizarGaleriaProdutos();
    } catch (e) {
        grid.innerHTML = '<div class="galeria-empty"><i class="fas fa-triangle-exclamation"></i><strong>Erro ao carregar a galeria.</strong><span>Tente atualizar o painel em alguns instantes.</span></div>';
        console.error(e);
    }
}

function prepararItensGaleria(produtos) {
    return produtos
        .map(produto => {
            const url = sanitizeImageUrl(produto.imagem, '');
            if (!url || !url.startsWith('http')) return null;

            return {
                id: produto.id,
                nome: produto.nome || 'Produto sem nome',
                categoria: produto.categoria || 'Sem categoria',
                ativo: produto.ativo === true,
                url,
                origem: getOrigemImagem(url)
            };
        })
        .filter(Boolean);
}

function getOrigemImagem(url) {
    if (url.includes('res.cloudinary.com')) return 'cloudinary';
    if (url.includes('i.ibb.co')) return 'legado';
    return 'externa';
}

function configurarEventosGaleria() {
    const busca = document.getElementById('galeria-busca');
    const status = document.getElementById('galeria-status');
    const categoria = document.getElementById('galeria-categoria');

    [busca, status, categoria].forEach(controle => {
        if (!controle || controle.dataset.bound === 'true') return;
        controle.addEventListener('input', renderizarGaleriaProdutos);
        controle.addEventListener('change', renderizarGaleriaProdutos);
        controle.dataset.bound = 'true';
    });
}

function atualizarCategoriasGaleria(itens) {
    const select = document.getElementById('galeria-categoria');
    if (!select) return;

    const valorAtual = select.value || 'todas';
    const categorias = [...new Set(itens.map(item => item.categoria).filter(Boolean))].sort((a, b) => a.localeCompare(b));

    select.innerHTML = '<option value="todas">Todas as categorias</option>';
    categorias.forEach(categoria => {
        const opt = document.createElement('option');
        opt.value = categoria;
        opt.textContent = categoria;
        select.appendChild(opt);
    });

    select.value = categorias.includes(valorAtual) ? valorAtual : 'todas';
}

function atualizarResumoGaleria(itens) {
    const total = document.getElementById('galeria-total');
    const totalCloudinary = document.getElementById('galeria-cloudinary-total');

    if (total) total.textContent = itens.length;
    if (totalCloudinary) totalCloudinary.textContent = itens.filter(item => item.origem === 'cloudinary').length;
}

function renderizarGaleriaProdutos() {
    const grid = document.getElementById('grid-galeria');
    if (!grid) return;

    const itens = window.galeriaImagensCache || [];
    const termo = (document.getElementById('galeria-busca')?.value || '').toLowerCase().trim();
    const status = document.getElementById('galeria-status')?.value || 'todos';
    const categoria = document.getElementById('galeria-categoria')?.value || 'todas';

    const filtrados = itens.filter(item => {
        const combinaBusca = !termo || `${item.nome} ${item.categoria}`.toLowerCase().includes(termo);
        const combinaStatus = status === 'todos' || (status === 'ativo' && item.ativo) || (status === 'desativado' && !item.ativo);
        const combinaCategoria = categoria === 'todas' || item.categoria === categoria;
        return combinaBusca && combinaStatus && combinaCategoria;
    });

    grid.innerHTML = '';

    if (itens.length === 0) {
        grid.innerHTML = '<div class="galeria-empty"><i class="fas fa-image"></i><strong>Nenhuma imagem encontrada.</strong><span>Cadastre uma imagem em algum produto para ela aparecer aqui.</span></div>';
        return;
    }

    if (filtrados.length === 0) {
        grid.innerHTML = '<div class="galeria-empty"><i class="fas fa-filter"></i><strong>Nenhum resultado para esse filtro.</strong><span>Ajuste a busca, categoria ou status.</span></div>';
        return;
    }

    filtrados.forEach(item => {
        const card = document.createElement('article');
        card.className = `galeria-card ${item.ativo ? 'is-active' : 'is-inactive'}`;
        card.tabIndex = 0;

        const origemLabel = item.origem === 'cloudinary' ? 'Cloudinary' : item.origem === 'legado' ? 'Link antigo' : 'Link externo';
        const statusLabel = item.ativo ? 'Ativo' : 'Desativado';
        const productName = escapeHTML(item.nome);
        const productCategory = escapeHTML(item.categoria);
        const productImage = escapeAttribute(item.url);

        card.innerHTML = `
            <div class="galeria-card-image">
                <img src="${productImage}" alt="${productName}" loading="lazy" decoding="async" data-fallback-src="${DEFAULT_IMAGE_FALLBACK}">
                <span class="galeria-origin ${item.origem}"><i class="fas fa-cloud"></i> ${origemLabel}</span>
                <button type="button" class="galeria-delete" title="Remover esta imagem dos produtos">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            <div class="galeria-card-body">
                <strong>${productName}</strong>
                <span>${productCategory}</span>
                <div class="galeria-card-footer">
                    <span class="galeria-status ${item.ativo ? 'ativo' : 'desativado'}">${statusLabel}</span>
                    <button type="button" class="galeria-select">Selecionar</button>
                </div>
            </div>`;

        card.querySelector('.galeria-select').addEventListener('click', () => selecionarImagemGaleria(item.url));
        card.querySelector('.galeria-delete').addEventListener('click', (e) => {
            e.stopPropagation();
            deletarImagemGaleria(item.url);
        });
        card.addEventListener('dblclick', () => selecionarImagemGaleria(item.url));
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') selecionarImagemGaleria(item.url);
        });

        attachImageFallbacks(card);
        grid.appendChild(card);
    });
}
export function fecharGaleria() {
    const modal = document.getElementById('modal-galeria');
    if (modal) modal.style.display = 'none';
}

export function selecionarImagemGaleria(url) {
    document.getElementById('p-foto-url').value = url;
    const preview = document.getElementById('preview-img');
    preview.dataset.fallbackSrc = DEFAULT_IMAGE_FALLBACK;
    attachImageFallbacks(preview.parentElement || document);
    preview.src = url;
    preview.style.display = 'block';
    
    document.getElementById('p-foto').value = '';
    window.croppedBlob = null; 
    
    fecharGaleria();
}

export async function deletarImagemGaleria(url) {
    if (LOCAL_TEST_MODE) {
        showLocalMutationBlocked('Exclusao de imagem');
        return;
    }

    if(confirm('🚨 Tem certeza que deseja remover esta imagem dos produtos?\n\nEla será removida da galeria e de todos os produtos que usam este link.')) {
        try {
            // 1. Tira a foto de todos os produtos que usam esse link no Banco de Dados
            const { error: dbError } = await supabase.from('produtos').update({ imagem: null }).eq('imagem', url);
            if (dbError) throw dbError;

            abrirGaleria();
            carregarProdutos();
            
            alert('Imagem removida dos produtos com sucesso!');
        } catch (e) {
            alert('Erro ao apagar imagem: ' + e.message);
        }
    }
}
