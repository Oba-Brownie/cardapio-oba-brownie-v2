/* ================================================= */
/* Gestão de cupons e promoções da vitrine           */
/* ================================================= */

import { supabase } from '../config/supabase-config.js';
import { escapeHTML, formatCurrencyBR, inlineJSString, safeNumber } from '../modules/utils.js';
import { LOCAL_TEST_MODE, getMockCupons, getMockProductsAdmin, showLocalMutationBlocked } from '../modules/local_test_mode.js';

let produtosPromocaoCache = [];

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

function renderPromocoesAtivas() {
    const container = document.getElementById('lista-produtos-promocao');
    if (!container) return;
    const products = produtosPromocaoCache.filter(product => safeNumber(product.preco_original) > safeNumber(product.preco));
    if (!products.length) {
        container.innerHTML = '<p class="promotion-empty">Ainda não há produtos com promoção ativa.</p>';
        return;
    }

    container.innerHTML = products.map(product => {
        const id = inlineJSString(product.id);
        return `<article class="promotion-active-item">
            <div>
                <strong>${escapeHTML(product.nome)}</strong>
                <span>${escapeHTML(product.categoria || 'Sem seção')} · ${Math.round(((product.preco_original - product.preco) / product.preco_original) * 100)}% de desconto</span>
            </div>
            <div class="promotion-active-prices">
                <s>R$ ${formatCurrencyBR(product.preco_original)}</s>
                <strong>R$ ${formatCurrencyBR(product.preco)}</strong>
            </div>
            <button type="button" class="promotion-remove-button" onclick="removerPromocao(${id})">Remover promoção</button>
        </article>`;
    }).join('');
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
        renderPromocoesAtivas();
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
    if (!Number.isInteger(percentual) || percentual < 1 || percentual > 99) return alert('Informe um desconto entre 1% e 99%.');

    const ativos = produtosPromocaoCache.filter(product => product.ativo);
    const selected = type === 'categoria'
        ? ativos.filter(product => product.categoria === category)
        : type === 'produto' ? ativos.filter(product => String(product.id) === productId) : ativos;
    if ((type === 'categoria' && !category) || (type === 'produto' && !productId) || !selected.length) {
        return alert('Selecione uma seção ou produto ativo para aplicar a promoção.');
    }

    const button = event.submitter;
    if (button) { button.disabled = true; button.textContent = 'APLICANDO...'; }
    const changes = selected.map(product => {
        const current = safeNumber(product.preco);
        const listed = safeNumber(product.preco_original);
        const basePrice = listed > current ? listed : current;
        return { product, basePrice, price: Math.round(basePrice * (1 - percentual / 100) * 100) / 100 };
    });
    const results = await Promise.all(changes.map(({ product, basePrice, price }) =>
        supabase.from('produtos').update({ preco_original: basePrice, preco: price }).eq('id', product.id)
    ));
    const failed = results.filter(result => result.error);
    if (button) { button.disabled = false; button.textContent = 'APLICAR PROMOÇÃO'; }
    if (failed.length) {
        await carregarCupons();
        alert(`A promoção foi salva parcialmente: ${changes.length - failed.length} de ${changes.length} produtos atualizados. Confira o estoque e tente novamente para os demais.`);
        return;
    }

    document.getElementById('promo-percentual').value = '';
    await carregarCupons();
    alert(`Promoção de ${percentual}% aplicada a ${changes.length} produto(s).`);
}

export async function removerPromocao(id) {
    if (LOCAL_TEST_MODE) return showLocalMutationBlocked('Remover promoção');
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
