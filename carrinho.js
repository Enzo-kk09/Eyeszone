'use strict';
let catalog = { products: [], categories: [] };
const currency = (value) => (value / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const cents = (product) => Math.round(product.price * 100);
const escapeText = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const productById = (id) => catalog.products.find((product) => product.id === String(id));
const categoryById = (id) => catalog.categories.find((category) => category.id === id);
function readSaved(key, fallback) {
    try {
        const data = JSON.parse(localStorage.getItem(key));
        return data ?? fallback;
    } catch {
        return fallback;
    }
}
function writeSaved(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch {
        notify('Não foi possível salvar neste navegador. Verifique se o armazenamento está permitido.');
        return false;
    }
}
function getCart() {
    const data = readSaved('eyeszone-cart-v2', []);
    if (!Array.isArray(data)) return [];
    return data.filter((line, index) => line && productById(line.id) && Number.isInteger(line.quantity) && line.quantity > 0 && line.quantity <= 99 && data.findIndex((entry) => entry?.id === line.id) === index);
}
function getComparison() {
    const data = readSaved('eyeszone-compare-v2', []);
    return Array.isArray(data) ? [...new Set(data)].filter((id) => productById(id)).slice(0, 3) : [];
}
function subtotal(lines = getCart()) {
    return lines.reduce((sum, line) => sum + cents(productById(line.id)) * line.quantity, 0);
}
function notify(message) {
    const notice = document.querySelector('#notice');
    if (!notice) return;
    notice.textContent = message;
    notice.hidden = false;
    clearTimeout(notify.timeout);
    notify.timeout = setTimeout(() => { notice.hidden = true; }, 4500);
}
function updateChrome() {
    document.querySelectorAll('.site-header nav a').forEach((link) => {
        if (link.getAttribute('href') === location.pathname.split('/').pop()) link.setAttribute('aria-current', 'page');
    });
    const count = getCart().reduce((sum, line) => sum + line.quantity, 0);
    document.querySelectorAll('[data-cart-count]').forEach((badge) => {
        badge.textContent = count;
        badge.hidden = count === 0;
    });
    document.querySelectorAll('.cart-nav').forEach((link) => link.setAttribute('aria-label', `Abrir carrinho, ${count} ${count === 1 ? 'item' : 'itens'}`));
    const ids = getComparison();
    document.querySelectorAll('[data-compare]').forEach((button) => {
        const active = ids.includes(button.dataset.compare);
        button.setAttribute('aria-pressed', String(active));
        button.textContent = active ? '✓ Selecionado' : '+ Comparar';
    });
    const dock = document.querySelector('#compare-dock');
    if (dock) {
        dock.hidden = !ids.length || !['produtos.html', 'categoria.html', 'busca.html'].includes(location.pathname.split('/').pop());
        document.querySelector('#compare-number').textContent = `${ids.length} de 3 produtos`;
    }
    document.body.classList.toggle('has-compare-dock', !!dock && !dock.hidden);
}
function toggleComparison(id) {
    const ids = getComparison();
    const index = ids.indexOf(id);
    if (index >= 0) ids.splice(index, 1);
    else if (ids.length < 3) ids.push(id);
    else {
        notify('Compare até 3 produtos. Remova um para adicionar outro.');
        return;
    }
    if (writeSaved('eyeszone-compare-v2', ids)) updateChrome();
}
function emptyState(title, text, link = 'produtos.html', label = 'Explorar produtos') {
    return `<section class="empty-state" aria-label="${escapeText(title)}"><span class="empty-mark" aria-hidden="true">↗</span><h2>${escapeText(title)}</h2><p>${escapeText(text)}</p><a class="button" href="${link}">${escapeText(label)} <span aria-hidden="true">↗</span></a></section>`;
}
function orderSummary(lines, shipping = null) {
    return `<dl class="totals"><div><dt>Produtos</dt><dd>${currency(subtotal(lines))}</dd></div><div><dt>Entrega</dt><dd>${shipping === null ? 'A calcular' : currency(shipping)}</dd></div><div class="total-line"><dt>${shipping === null ? 'Subtotal' : 'Total'}</dt><dd>${currency(subtotal(lines) + (shipping ?? 0))}</dd></div></dl>`;
}
function setPageError(error) {
    document.querySelector('#conteudo').innerHTML = emptyState('Não foi possível carregar.', 'Confira sua conexão e tente novamente.', location.pathname.split('/').pop() || 'index.html', 'Tentar novamente').replace('<h2>', '<h1 class="empty-title">').replace('</h2>', '</h1>');
}
async function startPage(render) {
    try {
        const response = await fetch('assets/catalog.json');
        if (!response.ok) throw new Error('Catálogo indisponível');
        catalog = await response.json();
        await render();
        updateChrome();
        document.addEventListener('click', (event) => {
            const compare = event.target.closest('[data-compare]');
            if (compare) toggleComparison(compare.dataset.compare);
            if (event.target.closest('[data-clear-compare]')) {
                if (writeSaved('eyeszone-compare-v2', [])) updateChrome();
            }
        });
        window.addEventListener('storage', (event) => {
            if (event.key?.startsWith('eyeszone-')) {
                updateChrome();
                window.dispatchEvent(new Event('eyeszone-storage'));
            }
        });
    } catch (error) {
        setPageError(error);
    }
}

startPage(() => {
    const content = document.querySelector('#cart-content');
    function renderCart() {
        const lines = getCart();
        if (!lines.length) {
            content.innerHTML = emptyState('Seu carrinho está vazio.', 'Encontre os equipamentos para o seu espaço.');
            updateChrome();
            return;
        }
        content.innerHTML = `<div class="purchase-layout"><section aria-labelledby="cart-items-title"><div class="content-topline"><h2 class="small-heading" id="cart-items-title">Seus equipamentos</h2><span class="field-help">${lines.reduce((sum, line) => sum + line.quantity, 0)} ${lines.reduce((sum, line) => sum + line.quantity, 0) === 1 ? 'item' : 'itens'}</span></div><ul class="cart-items">${lines.map((line) => {
            const product = productById(line.id);
            return `<li><article class="cart-item" aria-labelledby="cart-item-${product.id}"><a class="cart-image" href="produto.html?id=${product.id}"><img src="assets/${product.image}" alt="${escapeText(product.name)}" width="200" height="200"></a><div class="cart-item-copy"><p class="product-kicker">${escapeText(categoryById(product.category).short)}</p><h3 id="cart-item-${product.id}"><a href="produto.html?id=${product.id}">${escapeText(product.name)}</a></h3><p>${currency(cents(product))} / un.</p><button class="plain-button" type="button" data-remove="${product.id}" aria-label="Remover ${escapeText(product.name)} do carrinho">Remover</button></div><label class="field cart-quantity">Quantidade<input id="quantity-${product.id}" type="number" min="1" max="99" step="1" value="${line.quantity}" data-quantity="${product.id}" aria-label="Quantidade de ${escapeText(product.name)}" inputmode="numeric"></label><p class="cart-line-price">${currency(cents(product) * line.quantity)}</p></article></li>`;
        }).join('')}</ul><a class="text-link" href="produtos.html">← Continuar explorando</a></section><aside class="order-summary" aria-labelledby="summary-title"><span class="eyebrow">SUA ESCOLHA</span><h2 id="summary-title">Resumo<span>.</span></h2>${orderSummary(lines)}<a class="button full-button" href="checkout.html">Continuar <span aria-hidden="true">↗</span></a><p class="summary-footnote">Entrega e pagamento na próxima etapa.</p><p class="price-note">Compra demonstrativa, sem cobrança.</p></aside></div>`;
        updateChrome();
    }
    content.addEventListener('change', (event) => {
        const input = event.target.closest('[data-quantity]');
        if (!input) return;
        if (!input.reportValidity()) return;
        const value = Number(input.value);
        if (!Number.isInteger(value) || value < 1 || value > 99) return;
        const lines = getCart();
        const line = lines.find((entry) => entry.id === input.dataset.quantity);
        if (!line) return;
        line.quantity = value;
        if (writeSaved('eyeszone-cart-v2', lines)) {
            renderCart();
            document.querySelector(`#quantity-${line.id}`).focus({ preventScroll: true });
        }
    });
    content.addEventListener('click', (event) => {
        const button = event.target.closest('[data-remove]');
        if (button && writeSaved('eyeszone-cart-v2', getCart().filter((line) => line.id !== button.dataset.remove))) {
            renderCart();
            notify('Produto removido do carrinho.');
        }
    });
    window.addEventListener('eyeszone-storage', renderCart);
    renderCart();
});

function initializeHeaderSearch() {
    const root = document.querySelector('.header-search');
    if (!root) return;
    const toggle = root.querySelector('.search-toggle');
    const form = root.querySelector('form');
    const input = form.querySelector('input');
    const header = root.closest('.site-header');
    const primary = document.querySelector('#primary-search');
    if (primary) {
        toggle.setAttribute('aria-label', 'Editar busca');
        toggle.removeAttribute('aria-expanded');
        toggle.removeAttribute('aria-controls');
        toggle.addEventListener('click', () => {
            primary.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
            primary.elements.q.focus({ preventScroll: true });
        });
        form.remove();
        return;
    }
    const setOpen = (open, restoreFocus = false) => {
        root.classList.toggle('is-open', open);
        header.classList.toggle('search-open', open);
        toggle.setAttribute('aria-expanded', String(open));
        form.inert = !open;
        toggle.tabIndex = open ? -1 : 0;
        header.querySelectorAll('nav > a:not(.cart-nav)').forEach((link) => { link.inert = open; });
        if (open) requestAnimationFrame(() => requestAnimationFrame(() => {
            if (root.classList.contains('is-open')) input.focus({ preventScroll: true });
        }));
        else if (restoreFocus) toggle.focus({ preventScroll: true });
    };
    toggle.addEventListener('click', () => setOpen(true));
    root.querySelector('.search-close').addEventListener('click', () => setOpen(false, true));
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && root.classList.contains('is-open')) setOpen(false, true);
    });
    document.addEventListener('pointerdown', (event) => {
        if (!root.contains(event.target)) setOpen(false);
    });
    root.addEventListener('focusout', (event) => {
        if (!root.contains(event.relatedTarget)) setOpen(false);
    });
    form.addEventListener('submit', (event) => {
        input.value = input.value.trim();
        if (!input.value) {
            event.preventDefault();
            input.focus();
        }
    });
}
initializeHeaderSearch();
