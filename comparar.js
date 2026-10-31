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
function emptyState(title, text, link = 'produtos.html', label = 'Explorar produtos') {
    return `<section class="empty-state" aria-label="${escapeText(title)}"><span class="empty-mark" aria-hidden="true">↗</span><h2>${escapeText(title)}</h2><p>${escapeText(text)}</p><a class="button" href="${link}">${escapeText(label)} <span aria-hidden="true">↗</span></a></section>`;
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
    const region = document.querySelector('#comparison-content');
    const render = () => {
        const products = getComparison().map(productById);
        if (!products.length) {
            region.innerHTML = emptyState('O que vamos comparar?', 'Selecione até 3 produtos no catálogo para ver os detalhes lado a lado.');
            updateChrome();
            return;
        }
        const row = (label, content) => `<tr><th scope="row">${label}</th>${products.map((product) => `<td>${content(product)}</td>`).join('')}</tr>`;
        region.innerHTML = `<div class="content-topline"><p>${products.length} ${products.length === 1 ? 'produto selecionado. Adicione outro para comparar.' : 'produtos selecionados'}</p><a class="text-link" href="produtos.html">Escolher ${products.length < 3 ? 'outro' : 'produtos'} ↗</a></div><p class="table-hint">Deslize para comparar →</p><div class="table-scroll" role="region" aria-label="Tabela de comparação de produtos" tabindex="0"><table class="comparison-table"><caption class="visually-hidden">Características dos equipamentos selecionados</caption><thead><tr><td><span class="visually-hidden">Característica</span></td>${products.map((product) => `<th scope="col"><a class="comparison-image" href="produto.html?id=${product.id}" aria-label="Ver ${escapeText(product.name)}"><img src="assets/${product.image}" alt="" width="250" height="250"></a><a class="comparison-title" href="produto.html?id=${product.id}">${escapeText(product.name)}</a><button class="plain-button" type="button" data-remove-compare="${product.id}" aria-label="Remover ${escapeText(product.name)} da comparação">Remover</button></th>`).join('')}</tr></thead><tbody>${row('Preço', (product) => `<strong class="comparison-price">${currency(cents(product))}</strong>`)}${row('Categoria', (product) => escapeText(categoryById(product.category).name))}${row('Em resumo', (product) => escapeText(product.short))}${row('Recursos', (product) => `<ul>${product.features.map((feature) => `<li>${escapeText(feature)}</li>`).join('')}</ul>`)}${row('Compatibilidade', (product) => `<details><summary>Ver requisitos</summary><p>${escapeText(product.compatibility)}</p></details>`)}${row('Custos adicionais', () => 'Confira instalação, acessórios, armazenamento e possíveis assinaturas.')}${row('Sua escolha', (product) => `<button class="button" type="button" data-add="${product.id}" aria-label="Adicionar ${escapeText(product.name)} ao carrinho">Adicionar <span aria-hidden="true">+</span></button>`)}</tbody></table></div><p class="comparison-note">Compare as funções. A seleção não confirma compatibilidade entre os equipamentos.</p><p class="price-note">Preços ilustrativos para este projeto.</p>`;
        updateChrome();
    };
    region.addEventListener('click', (event) => {
        const remove = event.target.closest('[data-remove-compare]');
        const add = event.target.closest('[data-add]');
        if (remove && writeSaved('eyeszone-compare-v2', getComparison().filter((id) => id !== remove.dataset.removeCompare))) render();
        if (add) addToCart(add.dataset.add);
    });
    window.addEventListener('eyeszone-storage', render);
    render();
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
