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

function renderListing() {
    const form = document.querySelector('#catalog-filters');
    const categorySelect = form.elements.categoria;
    categorySelect.innerHTML = '<option value="">Todas as categorias</option>' + catalog.categories.map((category) => `<option value="${category.id}">${escapeText(category.name)}</option>`).join('');
    categorySelect.value = categoryById(parameters.get('categoria')) ? parameters.get('categoria') : '';
    form.elements.q.value = (parameters.get('q') || '').slice(0, 120);
    const maximum = Number(parameters.get('max'));
    if (Number.isFinite(maximum) && maximum > 0) form.elements.max.value = maximum;
    const order = document.querySelector('#sort-order');
    if (['relevance','price-up','price-down','name'].includes(parameters.get('ordem'))) order.value = parameters.get('ordem');
    const primarySearch = document.querySelector('#primary-search');
    if (primarySearch) primarySearch.elements.q.value = form.elements.q.value;
    const searchLabel = document.querySelector('#query-label');
    const grid = document.querySelector('#catalog-grid');
    const count = document.querySelector('#result-count');
    const render = () => {
        const term = normalizeText(form.elements.q.value.trim());
        const category = categorySelect.value;
        const max = Number(form.elements.max.value);
        const feature = form.elements.recurso.value;
        let products = catalog.products.filter((product) => {
            const text = normalizeText([product.name, product.short, product.description, ...product.features].join(' '));
            return (!term || term.split(/\s+/).every((word) => text.includes(word))) && (!category || product.category === category) && (!max || cents(product) <= Math.round(max * 100)) && (!feature || text.includes(feature));
        });
        products.sort((a, b) => {
            if (order.value === 'price-up') return a.price - b.price;
            if (order.value === 'price-down') return b.price - a.price;
            if (order.value === 'name') return a.name.localeCompare(b.name, 'pt-BR');
            const priority = ['15','14','18','17','16','21','20','22','23','19'];
            return (priority.includes(a.id) ? priority.indexOf(a.id) : 100 + Number(a.id)) - (priority.includes(b.id) ? priority.indexOf(b.id) : 100 + Number(b.id));
        });
        count.textContent = `${products.length} ${products.length === 1 ? 'equipamento' : 'equipamentos'}`;
        grid.innerHTML = products.length ? products.map(productCard).join('') : `<div class="catalog-empty">${emptyState('Nenhum resultado.', 'Tente outra palavra ou remova um filtro.', 'produtos.html', 'Ver todos os produtos')}</div>`;
        if (searchLabel) searchLabel.textContent = term ? `Resultados para “${form.elements.q.value.trim()}”` : 'Explore por nome, modelo ou recurso.';
        if (document.body.dataset.page === 'categoria') {
            const chosen = categoryById(category);
            document.querySelector('.breadcrumbs').innerHTML = `<a href="index.html">Início</a><span aria-hidden="true">/</span><a href="categoria.html">Categorias</a><span aria-hidden="true">/</span><span aria-current="page">${escapeText(chosen?.short || 'Equipamentos')}</span>`;
            document.querySelectorAll('#category-navigation a').forEach((link) => {
                if (link.getAttribute('href') === 'categoria.html?categoria=' + category) link.setAttribute('aria-current', 'page');
                else link.removeAttribute('aria-current');
            });
            document.querySelector('#page-title').innerHTML = `${escapeText(chosen?.name || 'Equipamentos')}<span>.</span>`;
            document.title = `${chosen?.name || 'Equipamentos'} | EYESZONE`;
        }
        updateChrome();
        const query = new URLSearchParams();
        if (form.elements.q.value.trim()) query.set('q', form.elements.q.value.trim());
        if (category) query.set('categoria', category);
        if (max > 0) query.set('max', max);
        if (feature) query.set('recurso', feature);
        if (order.value !== 'relevance') query.set('ordem', order.value);
        history.replaceState(null, '', location.pathname + (query.size ? '?' + query.toString() : ''));
    };
    form.elements.recurso.value = ['wi-fi', 'noturna', 'sem fio'].includes(parameters.get('recurso')) ? parameters.get('recurso') : '';
    let inputTimer;
    form.addEventListener('input', () => { clearTimeout(inputTimer); inputTimer = setTimeout(render, 150); });
    form.addEventListener('change', render);
    form.addEventListener('submit', (event) => { event.preventDefault(); render(); });
    order.addEventListener('change', render);
    document.querySelector('#clear-filters').addEventListener('click', () => {
        form.reset();
        order.value = 'relevance';
        if (primarySearch) primarySearch.reset();
        render();
    });
    if (primarySearch) primarySearch.addEventListener('submit', (event) => {
        event.preventDefault();
        form.elements.q.value = primarySearch.elements.q.value;
        render();
        grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    if (window.matchMedia('(max-width: 760px)').matches) document.querySelector('.filter-panel').open = false;
    render();
}

startPage(renderListing);
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
