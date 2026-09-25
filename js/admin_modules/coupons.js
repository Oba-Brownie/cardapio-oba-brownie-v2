/* ================================================= */
/* Gestão de cupons e promoções da vitrine           */
/* ================================================= */

import { supabase } from '../config/supabase-config.js';
import { escapeHTML, formatCurrencyBR, inlineJSString, safeNumber } from '../modules/utils.js';
import { LOCAL_TEST_MODE, getMockCupons, getMockProductsAdmin, showLocalMutationBlocked } from '../modules/local_test_mode.js';

let produtosPromocaoCache = [];
let promocoesAtivasCache = [];

function getSelectedValue(name, fallback) {
    return document.querySelector(`input[name="${name}"]:checked`)?.value || fallback;
}

function categoryOptions(products) {
    return [...new Set(products.map(product => product.categoria).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

function fillSelect(select, items, placeholder, getValue, getLabel) {
    if (!select) return;
    select.replaceChildren();
    const initial = document.createElement('option');
    initial.value = '';
    initial.textContent = placeholder;
    select.appendChild(initial);
    items.forEach(item => {
        const option = document.createElement('option');
        option.value = getValue(item);
        option.textContent = getLabel(item);
        select.appendChild(option);
    });
    select.disabled = items.length === 0;
}

async function carregarProdutosPromocao() {
    if (LOCAL_TEST_MODE) return getMockProductsAdmin();
    const { data, error } = await supabase
        .from('produtos')
        .select('id, nome, preco, preco_original, categoria, ativo')
        .order('nome', { ascending: true });
    if (error) throw error;
    return data || [];
}

async function prepararOpcoesPromocao() {
    const ativos = produtosPromocaoCache.filter(product => product.ativo);
    const categorias = categoryOptions(produtosPromocaoCache);

    fillSelect(document.getElementById('c-categoria'), categorias, 'Selecione uma seção', value => value, value => value);
    fillSelect(document.getElementById('promo-categoria'), categorias, 'Selecione uma seção', value => value, value => value);
    fillSelect(
        document.getElementById('promo-produto'),
        ativos,
        'Selecione um produto',
        product => String(product.id),
        product => `${product.nome} — R$ ${formatCurrencyBR(product.preco)}`
    );
}

function atualizarCamposDeEscopo() {
    const scope = getSelectedValue('c-escopo', 'loja');
    const wrapper = document.getElementById('c-categoria-wrap');
    const select = document.getElementById('c-categoria');
    if (wrapper && select) {
        wrapper.hidden = scope !== 'categoria';
        select.required = scope === 'categoria';
        select.disabled = scope !== 'categoria' || select.options.length <= 1;
    }
}

function atualizarCamposDePromocao() {
    const type = document.getElementById('promo-tipo')?.value || 'loja';
    const categoryWrap = document.getElementById('promo-categoria-wrap');
    const productWrap = document.getElementById('promo-produto-wrap');
    const categorySelect = document.getElementById('promo-categoria');
    const productSelect = document.getElementById('promo-produto');
    if (categoryWrap && categorySelect) {
        categoryWrap.hidden = type !== 'categoria';
        categorySelect.required = type === 'categoria';
        categorySelect.disabled = type !== 'categoria' || categorySelect.options.length <= 1;
    }
    if (productWrap && productSelect) {
        productWrap.hidden = type !== 'produto';
        productSelect.required = type === 'produto';
        productSelect.disabled = type !== 'produto' || productSelect.options.length <= 1;
    }
}

function renderPromocoesAtivas(promotions, loadError = null) {
    const container = document.getElementById('lista-produtos-promocao');
    if (!container) return;
    const campaignRows = (promotions || []).map(promotion => {
        const targetType = promotion.target_tipo;
        const targetName = targetType === 'loja' ? 'Toda a loja'
            : targetType === 'categoria' ? `Seção: ${escapeHTML(promotion.target_valor)}`
                : `Produto: ${escapeHTML(produtosPromocaoCache.find(product => String(product.id) === String(promotion.target_valor))?.nome || 'Produto indisponível')}`;
        const minimum = safeNumber(promotion.valor_minimo) > 0
            ? `Pedido mínimo de R$ ${formatCurrencyBR(promotion.valor_minimo)}` : 'Sem pedido mínimo';
        const id = inlineJSString(promotion.id);
        return `<article class="promotion-active-item">
            <div><strong>${targetName}</strong><span>${minimum}</span></div>
            <div class="promotion-active-prices"><strong>${safeNumber(promotion.desconto_percentual)}% OFF</strong></div>
            <button type="button" class="promotion-remove-button" onclick="deletarPromocao(${id})">Remover promoção</button>
        </article>`;
    }).join('');

    const legacyProducts = produtosPromocaoCache.filter(product => safeNumber(product.preco_original) > safeNumber(product.preco));
    const legacyRows = legacyProducts.map(product => {
        const id = inlineJSString(product.id);
        return `<article class="promotion-active-item">
            <div>
                <strong>${escapeHTML(product.nome)} <small>(preço promocional do produto)</small></strong>
                <span>${escapeHTML(product.categoria || 'Sem seção')}</span>
            </div>
            <div class="promotion-active-prices">
                <strong>${Math.round(((product.preco_original - product.preco) / product.preco_original) * 100)}% OFF</strong>
                <s>R$ ${formatCurrencyBR(product.preco_original)}</s>
                <strong>R$ ${formatCurrencyBR(product.preco)}</strong>
            </div>
            <button type="button" class="promotion-remove-button" onclick="removerPromocaoProduto(${id})">Restaurar preço</button>
        </article>`;
    }).join('');
    const parts = [];
    if (loadError) parts.push('<p class="coupon-error">Não foi possível carregar campanhas. Aplique a migration descrita em MIGRACAO_CUPONS.md.</p>');
    if (campaignRows) parts.push(`<h3 class="promotion-list-title">Campanhas ativas</h3>${campaignRows}`);
    else if (!loadError) parts.push('<p class="promotion-empty">Ainda não há campanhas ativas.</p>');
    if (legacyRows) parts.push(`<h3 class="promotion-list-title">Preços promocionais cadastrados nos produtos</h3>${legacyRows}`);
    container.innerHTML = parts.join('');
}

export async function carregarCupons() {
    const div = document.getElementById('lista-cupons');
    if (div) div.innerHTML = '<p class="admin-loading">Carregando cupons...</p>';

    try {
        const [couponResult, products] = await Promise.all([
            LOCAL_TEST_MODE
                ? Promise.resolve({ data: getMockCupons(), error: null })
                : supabase.from('cupons').select('*').order('id', { ascending: false }),
            carregarProdutosPromocao()
        ]);
        if (couponResult.error) throw couponResult.error;
        produtosPromocaoCache = products;
        await prepararOpcoesPromocao();
        atualizarCamposDeEscopo();
        atualizarCamposDePromocao();

        let promotionLoadError = null;
        promocoesAtivasCache = [];
        if (!LOCAL_TEST_MODE) {
            const promotionResult = await supabase.from('promocoes')
                .select('id, target_tipo, target_valor, desconto_percentual, valor_minimo, criado_em')
                .eq('ativo', true)
                .order('criado_em', { ascending: false });
            if (promotionResult.error) promotionLoadError = promotionResult.error;
            else promocoesAtivasCache = promotionResult.data || [];
        }

        if (div) {
            const coupons = couponResult.data || [];
            if (!coupons.length) {
                div.innerHTML = '<p class="promotion-empty">Nenhum cupom cadastrado.</p>';
            } else {
                const rows = coupons.map(coupon => {
                    const quantityStyle = coupon.quantidade <= 0 ? ' class="coupon-exhausted"' : '';
                    const quantityText = coupon.quantidade <= 0 ? 'Esgotado' : escapeHTML(coupon.quantidade);
                    const minimum = coupon.valor_minimo > 0 ? `R$ ${formatCurrencyBR(coupon.valor_minimo)}` : 'Sem mínimo';
                    const scope = coupon.target_tipo || 'loja';
                    const scopeText = scope === 'frete' ? 'Taxa de entrega' : scope === 'categoria'
                        ? `Seção: ${escapeHTML(coupon.target_categoria || 'Não definida')}` : 'Toda a loja';
                    const id = inlineJSString(coupon.id);
                    return `<tr>
                        <td><strong class="coupon-code">${escapeHTML(coupon.codigo)}</strong></td>
                        <td>${safeNumber(coupon.desconto_percentual)}%</td>
                        <td>${minimum}</td>
                        <td>${scopeText}</td>
                        <td${quantityStyle}>${quantityText}</td>
                        <td><button type="button" class="coupon-delete-button" aria-label="Excluir cupom ${escapeHTML(coupon.codigo)}" onclick="deletarCupom(${id})"><i class="fas fa-trash" aria-hidden="true"></i></button></td>
                    </tr>`;
                }).join('');
                div.innerHTML = `<div class="coupon-table-wrap"><table class="tabela-pedidos"><thead><tr><th>Código</th><th>Desconto</th><th>Mínimo</th><th>Aplicação</th><th>Restantes</th><th>Ação</th></tr></thead><tbody>${rows}</tbody></table></div>`;
            }
        }
        renderPromocoesAtivas(promocoesAtivasCache, promotionLoadError);
    } catch (error) {
        if (div) div.innerHTML = '<p class="coupon-error">Não foi possível carregar cupons e produtos. Tente novamente.</p>';
        const promoList = document.getElementById('lista-produtos-promocao');
        if (promoList) promoList.innerHTML = '<p class="coupon-error">Não foi possível carregar as promoções.</p>';
        console.error('Falha ao carregar cupons e produtos promocionais.', error);
    }
}

export async function salvarCupom(event) {
    event.preventDefault();
    if (LOCAL_TEST_MODE) return showLocalMutationBlocked('Salvar cupom');

    const codigo = document.getElementById('c-codigo').value.trim().toUpperCase();
    const desconto = Number(document.getElementById('c-desconto').value);
    const quantidade = Number.parseInt(document.getElementById('c-qtd').value, 10);
    const minimo = Number(document.getElementById('c-minimo').value) || 0;
    const targetType = getSelectedValue('c-escopo', 'loja');
    const targetCategory = targetType === 'categoria' ? document.getElementById('c-categoria').value : null;

    if (!codigo || !Number.isFinite(desconto) || desconto < 1 || desconto > 100 || !Number.isInteger(quantidade) || quantidade < 1 || minimo < 0 || (targetType === 'categoria' && !targetCategory)) {
        alert('Confira os dados do cupom e selecione uma seção quando necessário.');
        return;
    }

    const { error } = await supabase.from('cupons').insert([{
        codigo,
        desconto_percentual: desconto,
        quantidade,
        valor_minimo: minimo,
        target_tipo: targetType,
        target_categoria: targetCategory
    }]);

    if (error) {
        if (error.code === '23505') alert('Este código já existe!');
        else if (error.code === '42703' || error.code === 'PGRST204') alert('Aplique a migration descrita em MIGRACAO_CUPONS.md para habilitar o escopo dos cupons.');
        else alert('Não foi possível criar o cupom. Confira a conexão e as permissões do Supabase.');
        return;
    }

    document.getElementById('c-codigo').value = '';
    document.getElementById('c-desconto').value = '';
    document.getElementById('c-qtd').value = '';
    document.getElementById('c-minimo').value = '0';
    document.querySelector('input[name="c-escopo"][value="loja"]').checked = true;
    document.getElementById('c-categoria').value = '';
    atualizarCamposDeEscopo();
    await carregarCupons();
}

export async function deletarCupom(id) {
    if (LOCAL_TEST_MODE) return showLocalMutationBlocked('Exclusão de cupom');
    if (!confirm('Deseja apagar este cupom?')) return;
    const { error } = await supabase.from('cupons').delete().eq('id', id);
    if (error) return alert('Não foi possível excluir o cupom. Confira as permissões do Supabase.');
    await carregarCupons();
}

export async function salvarPromocao(event) {
    event.preventDefault();
    if (LOCAL_TEST_MODE) return showLocalMutationBlocked('Aplicar promoção');

    const percentual = Number(document.getElementById('promo-percentual').value);
    const type = document.getElementById('promo-tipo').value;
    const category = document.getElementById('promo-categoria').value;
    const productId = document.getElementById('promo-produto').value;
    const minimumValue = document.getElementById('promo-minimo').value.trim();
    const minimum = minimumValue === '' ? 0 : Number(minimumValue);
    if (!['loja', 'categoria', 'produto'].includes(type)
        || !Number.isInteger(percentual) || percentual < 1 || percentual > 99
        || !Number.isFinite(minimum) || minimum < 0) {
        return alert('Informe um desconto entre 1% e 99% e um pedido mínimo válido.');
    }

    const targetValue = type === 'categoria' ? category : type === 'produto' ? productId : null;
    const activeProducts = produtosPromocaoCache.filter(product => product.ativo);
    const selected = type === 'categoria'
        ? activeProducts.filter(product => product.categoria === category)
        : type === 'produto' ? activeProducts.filter(product => String(product.id) === productId) : activeProducts;
    if ((type === 'categoria' && !category) || (type === 'produto' && !productId) || !selected.length) {
        return alert('Selecione uma seção ou produto ativo para aplicar a promoção.');
    }

    const button = event.submitter;
    if (button) { button.disabled = true; button.textContent = 'SALVANDO...'; }
    const { error } = await supabase.from('promocoes').insert([{
        target_tipo: type,
        target_valor: targetValue,
        desconto_percentual: percentual,
        valor_minimo: minimum,
        ativo: true
    }]);
    if (button) { button.disabled = false; button.textContent = 'APLICAR PROMOÇÃO'; }
    if (error) {
        if (error.code === '42P01' || error.code === 'PGRST205' || error.code === 'PGRST204') {
            alert('A tabela de promoções ainda não existe. Aplique a migration descrita em MIGRACAO_CUPONS.md.');
        } else {
            alert('Não foi possível salvar a promoção. Confira a conexão e as permissões do Supabase.');
        }
        return;
    }
    document.getElementById('promo-percentual').value = '';
    document.getElementById('promo-minimo').value = '';
    await carregarCupons();
    alert(`Promoção de ${percentual}% cadastrada para ${selected.length} produto(s)${minimum > 0 ? ` a partir de R$ ${formatCurrencyBR(minimum)} no subtotal dos produtos` : ''}.`);
}

export async function deletarPromocao(id) {
    if (LOCAL_TEST_MODE) return showLocalMutationBlocked('Remover promoção');
    const promotion = promocoesAtivasCache.find(item => String(item.id) === String(id));
    if (!promotion || !confirm(`Remover esta promoção de ${safeNumber(promotion.desconto_percentual)}%?`)) return;
    const { error } = await supabase.from('promocoes').delete().eq('id', id);
    if (error) return alert('Não foi possível remover a promoção. Confira as permissões do Supabase.');
    await carregarCupons();
}

export async function removerPromocaoProduto(id) {
    if (LOCAL_TEST_MODE) return showLocalMutationBlocked('Restaurar preço do produto');
    const product = produtosPromocaoCache.find(item => String(item.id) === String(id));
    if (!product || !confirm(`Remover a promoção de ${product.nome} e restaurar o preço de R$ ${formatCurrencyBR(product.preco_original)}?`)) return;
    const { error } = await supabase.from('produtos').update({ preco: product.preco_original, preco_original: null }).eq('id', id);
    if (error) return alert('Não foi possível remover a promoção. Confira as permissões do Supabase.');
    await carregarCupons();
}

document.addEventListener('change', event => {
    if (event.target.matches('input[name="c-escopo"]')) atualizarCamposDeEscopo();
    if (event.target.id === 'promo-tipo') atualizarCamposDePromocao();
});
