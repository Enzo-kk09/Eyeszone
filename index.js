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

const intro = document.querySelector('.intro');
const eyeOutline = document.querySelector('.eye-outline');
const eyeClip = document.querySelector('.eye-clip');
const lashes = document.querySelector('.eye-lashes');
let eyeFrame = null;
let eyeClosing = 0;
let eyeTarget = 0;
let eyeTime = null;
function drawEye(closing) {
    const upper = 3 + closing * 139;
    const lower = 219 - closing * 77;
    const opening = `M46 111Q160 ${upper} 274 111Q160 ${lower} 46 111Z`;
    eyeOutline.setAttribute('d', opening);
    eyeClip.setAttribute('d', opening);
    lashes.style.transform = `translateY(${closing * 53}px) scaleY(${1 - closing * 0.85})`;
    lashes.style.opacity = String(1 - closing * closing);
}
function animateEye(time) {
    const elapsed = eyeTime === null ? 16 : Math.min(48, time - eyeTime);
    eyeTime = time;
    eyeClosing += (eyeTarget - eyeClosing) * (1 - Math.exp(-elapsed / 115));
    if (Math.abs(eyeTarget - eyeClosing) < 0.001) eyeClosing = eyeTarget;
    drawEye(eyeClosing);
    if (eyeClosing !== eyeTarget) eyeFrame = requestAnimationFrame(animateEye);
    else {
        eyeFrame = null;
        eyeTime = null;
    }
}
function updateEyeScroll() {
    const height = document.querySelector('.intro-stage').getBoundingClientRect().height;
    const distance = Math.max(200, height * 0.38);
    const progress = Math.max(0, Math.min(1, -intro.getBoundingClientRect().top / distance));
    eyeTarget = progress * progress * (3 - 2 * progress);
    if (eyeFrame === null) eyeFrame = requestAnimationFrame(animateEye);
}
document.addEventListener('scroll', updateEyeScroll, { passive: true, capture: true });
window.addEventListener('pageshow', updateEyeScroll);
window.addEventListener('resize', updateEyeScroll);
drawEye(0);
updateEyeScroll();
const details = {
    escolha: { title: 'Escolha sem dúvidas.', content: '<ul><li>Defina o ambiente e o que deseja acompanhar.</li><li>Confira a conexão e a alimentação necessárias.</li><li>Veja como as gravações serão armazenadas.</li><li>Verifique acessórios, instalação e eventuais assinaturas.</li><li>Consulte a garantia e o suporte antes da compra.</li></ul>' }
};
const dialog = document.querySelector('#detail-dialog');
let opener;
document.querySelectorAll('[data-detail]').forEach((button) => {
    button.addEventListener('click', () => {
        const detail = details[button.dataset.detail];
        opener = button;
        document.querySelector('#dialog-title').textContent = detail.title;
        document.querySelector('#dialog-content').innerHTML = detail.content;
        dialog.showModal();
    });
});
document.querySelector('#close-dialog').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', (event) => {
    if (event.target === dialog) {
        const bounds = dialog.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
    }
});
dialog.addEventListener('close', () => opener?.focus());


startPage(() => {});

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
