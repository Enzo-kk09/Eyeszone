'use strict';
let catalog = { products: [], categories: [] };
const currency = (value) => (value / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const cents = (product) => Math.round(product.price * 100);
const escapeText = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
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
    const product = productById(parameters.get('id') || '15');
    const main = document.querySelector('#conteudo');
    if (!product) {
        main.innerHTML = emptyState('Produto não encontrado.', 'Explore outros equipamentos do catálogo.').replace('<h2>', '<h1 class="empty-title">').replace('</h2>', '</h1>');
        return;
    }
    const category = categoryById(product.category);
    document.title = `${product.name} | EYESZONE`;
    main.innerHTML = `<article class="product-detail" aria-labelledby="product-title"><nav class="breadcrumbs" aria-label="Caminho da página"><a href="index.html">Início</a><span aria-hidden="true">/</span><a href="categoria.html?categoria=${category.id}">${escapeText(category.short)}</a><span aria-hidden="true">/</span><span aria-current="page">${escapeText(product.name)}</span></nav><div class="product-overview"><figure class="product-figure"><button class="gallery-button ${product.photoStyle === 'context' ? 'photo-context' : ''}" type="button" id="open-gallery" aria-label="Ampliar imagem de ${escapeText(product.name)}"><img src="assets/${escapeText(product.image)}" alt="${escapeText(product.name)}" width="1000" height="1000" fetchpriority="high"><span class="gallery-hint">Ampliar imagem ↗</span></button><figcaption>${product.source ? `Foto: ${escapeText(product.source.imageCredit)}` : 'Imagem do catálogo EYESZONE'}</figcaption></figure><section class="product-purchase" aria-labelledby="product-title"><p class="product-kicker">${escapeText(category.name)}</p><h1 id="product-title">${escapeText(product.name)}<span>.</span></h1><p class="product-short">${escapeText(product.short)}</p><p class="detail-price">${currency(cents(product))}</p><p class="price-note">Preço ilustrativo · Frete no checkout</p><form id="add-product"><div class="field quantity-field"><label for="product-quantity">Quantidade</label><span class="quantity-control"><button type="button" data-quantity-step="-1" aria-label="Diminuir quantidade">−</button><input id="product-quantity" name="quantidade" type="number" min="1" max="99" step="1" value="1" required inputmode="numeric" ><button type="button" data-quantity-step="1" aria-label="Aumentar quantidade">+</button></span></div><button class="button" type="submit">Adicionar ao carrinho <span aria-hidden="true">↗</span></button></form><div class="purchase-links"><button class="compare-button" type="button" data-compare="${product.id}" aria-label="Comparar ${escapeText(product.name)}" aria-pressed="false">+ Comparar</button><a class="text-link" href="comparar.html">Ver comparação ↗</a><a class="text-link" href="carrinho.html">Ver carrinho ↗</a></div><p class="product-application">${escapeText(product.application)}</p></section></div><div class="product-information"><section aria-labelledby="about-product"><span class="eyebrow">ANTES DE ESCOLHER</span><h2 id="about-product">Os detalhes importam<span>.</span></h2><p>${escapeText(product.description)}</p></section><div class="product-accordions"><details open><summary>Recursos</summary><ul>${product.features.map((feature) => `<li>${escapeText(feature)}</li>`).join('')}</ul></details><details><summary>Compatibilidade e instalação</summary><p>${escapeText(product.compatibility)}</p></details><details><summary>Itens, custos e garantia</summary><p>Confira a composição da embalagem e a garantia do modelo. Considere os custos de instalação, acessórios, armazenamento e possíveis assinaturas antes de comprar.</p>${product.source ? `<a class="text-link" href="${escapeText(product.source.url)}" target="_blank" rel="noopener noreferrer">Ficha do fabricante ↗</a>` : '<p>As especificações completas devem ser confirmadas com o fornecedor.</p>'}</details></div></div></article><section class="shop-content related-products" aria-labelledby="related-title"><div class="section-heading"><div><span class="eyebrow">CONTINUE EXPLORANDO</span><h2 id="related-title">Outras opções<span>.</span></h2></div><a class="text-link" href="categoria.html?categoria=${category.id}">Ver categoria ↗</a></div><div class="catalog-grid">${catalog.products.filter((entry) => entry.category === product.category && entry.id !== product.id).slice(-3).map((entry) => productCard(entry).replaceAll('<h2>', '<h3>').replaceAll('</h2>', '</h3>')).join('')}</div></section><dialog class="product-gallery" id="product-gallery" aria-labelledby="gallery-title"><div class="dialog-top"><h2 id="gallery-title">${escapeText(product.name)}</h2><button id="close-gallery" type="button" aria-label="Fechar imagem">×</button></div><img src="assets/${escapeText(product.image)}" alt="${escapeText(product.name)} em tamanho ampliado" width="1000" height="1000"></dialog>`;
    document.querySelector('#add-product').addEventListener('submit', (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        if (!form.reportValidity()) return;
        addToCart(product.id, Number(form.elements.quantidade.value));
    });
    document.querySelectorAll('[data-quantity-step]').forEach((button) => {
        button.addEventListener('click', () => {
            const input = document.querySelector('#add-product').elements.quantidade;
            input.value = Math.max(1, Math.min(99, (Number(input.value) || 1) + Number(button.dataset.quantityStep)));
        });
    });
    const gallery = document.querySelector('#product-gallery');
    const opener = document.querySelector('#open-gallery');
    opener.addEventListener('click', () => gallery.showModal());
    document.querySelector('#close-gallery').addEventListener('click', () => gallery.close());
    gallery.addEventListener('close', () => opener.focus());
    gallery.addEventListener('click', (event) => { if (event.target === gallery) gallery.close(); });
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
