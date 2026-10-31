'use strict';
let catalog = { products: [], categories: [] };
const currency = (value) => (value / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const cents = (product) => Math.round(product.price * 100);
const escapeText = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const normalizeText = (value) => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const productById = (id) => catalog.products.find((product) => product.id === String(id));
const categoryById = (id) => catalog.categories.find((category) => category.id === id);
const parameters = new URLSearchParams(location.search);
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
function addToCart(id, quantity = 1) {
    const product = productById(id);
    if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) return false;
    const lines = getCart();
    const existing = lines.find((line) => line.id === id);
    if (existing && existing.quantity + quantity > 99) {
        notify('O limite é de 99 unidades por produto.');
        return false;
    }
    if (existing) existing.quantity += quantity;
    else lines.push({ id, quantity });
    if (!writeSaved('eyeszone-cart-v2', lines)) return false;
    updateChrome();
    notify('Produto adicionado ao carrinho.');
    return true;
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
function productCard(product) {
    const category = categoryById(product.category);
    return `<article class="catalog-card"><a class="catalog-photo ${product.photoStyle === 'context' ? 'photo-context' : ''}" href="produto.html?id=${product.id}"><img src="assets/${escapeText(product.image)}" alt="${escapeText(product.name)}" width="600" height="600" loading="lazy"><span class="photo-arrow" aria-hidden="true">↗</span></a><div class="catalog-copy"><p class="product-kicker">${escapeText(category.short)}</p><h2><a href="produto.html?id=${product.id}">${escapeText(product.name)}</a></h2><p class="catalog-spec">${escapeText(product.short)}</p><p class="catalog-price">${currency(cents(product))}</p><button class="compare-button" type="button" data-compare="${product.id}" aria-pressed="false" aria-label="Comparar ${escapeText(product.name)}">+ Comparar</button></div></article>`;
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

function getOrders() {
    const orders = readSaved('eyeszone-orders-v2', []);
    if (!Array.isArray(orders)) return [];
    return orders.filter((order) => order && /^EZ-[A-Z0-9]{8}$/.test(order.id) && Number.isFinite(Date.parse(order.createdAt)) && Array.isArray(order.items) && order.items.length && order.items.every((item) => productById(item.id) && Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= 99 && Number.isInteger(item.unitPrice) && item.unitPrice >= 0) && [1990, 3490].includes(order.shipping) && order.total === order.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, order.shipping));
}
function formatDate(value) {
    return new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
}
function receipt(order) {
    return `<div class="receipt-layout"><section class="receipt-card" aria-labelledby="receipt-title"><div class="receipt-heading"><div><span class="eyebrow">PEDIDO DEMONSTRATIVO</span><h2 id="receipt-title">${escapeText(order.id)}</h2></div><time datetime="${escapeText(order.createdAt)}">${formatDate(order.createdAt)}</time></div><ul class="receipt-items">${order.items.map((item) => `<li><img src="assets/${productById(item.id).image}" alt="" width="100" height="100"><div><a href="produto.html?id=${item.id}">${escapeText(item.name)}</a><p>${item.quantity} ${item.quantity === 1 ? 'unidade' : 'unidades'} · ${currency(item.unitPrice)} / un.</p></div><strong>${currency(item.unitPrice * item.quantity)}</strong></li>`).join('')}</ul></section><aside class="order-summary" aria-labelledby="receipt-summary-title"><span class="eyebrow">TUDO CONFERIDO</span><h2 id="receipt-summary-title">Resumo<span>.</span></h2><dl class="totals"><div><dt>Produtos</dt><dd>${currency(order.total - order.shipping)}</dd></div><div><dt>Entrega ${order.delivery === 'expressa' ? 'expressa' : 'padrão'}</dt><dd>${currency(order.shipping)}</dd></div><div><dt>Pagamento escolhido</dt><dd>${order.payment === 'cartao' ? `Cartão · ${[1,2,3].includes(order.installments) ? order.installments : 1}x` : 'Pix'}</dd></div><div class="total-line"><dt>Total</dt><dd>${currency(order.total)}</dd></div></dl><p class="summary-footnote">Valores ilustrativos. Nenhum pagamento foi processado.</p><a class="text-link" href="produtos.html">Explorar produtos ↗</a></aside></div>`;
}

startPage(() => {
    const orders = getOrders();
    const content = document.querySelector('#orders-content');
    const id = parameters.get('id');
    if (id) {
        const order = orders.find((entry) => entry.id === id);
        if (!order) {
            content.innerHTML = emptyState('Pedido não encontrado.', 'Este pedido não está salvo neste navegador.', 'pedido.html', 'Ver meus pedidos');
            return;
        }
        document.querySelector('#page-title').innerHTML = 'Seu pedido<span>.</span>';
        content.innerHTML = receipt(order) + '<div class="receipt-actions"><a class="text-link" href="pedido.html">← Todos os pedidos</a></div>';
        return;
    }
    if (!orders.length) {
        content.innerHTML = emptyState('Nenhum pedido por aqui.', 'Depois de concluir uma compra demonstrativa, ela aparece aqui.');
        return;
    }
    content.innerHTML = `<div class="order-history">${orders.map((order) => `<article class="order-history-card" aria-labelledby="order-${order.id}"><header><h2 id="order-${order.id}">${escapeText(order.id)}</h2><time datetime="${escapeText(order.createdAt)}">${formatDate(order.createdAt)}</time></header><div><p>${order.items.reduce((sum, item) => sum + item.quantity, 0)} itens · Pedido demonstrativo</p><strong>${currency(order.total)}</strong><a class="text-link" href="pedido.html?id=${encodeURIComponent(order.id)}">Ver detalhes ↗</a></div></article>`).join('')}</div>`;
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
