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
    const content = document.querySelector('#checkout-content');
    let lines = getCart();
    if (!lines.length) {
        content.innerHTML = emptyState('Escolha seus equipamentos primeiro.', 'Seu carrinho está vazio.');
        return;
    }
    document.querySelector('#form-notice').textContent = 'Pedido demonstrativo. Nenhuma cobrança ou entrega será realizada.';
    const form = document.querySelector('#checkout-form');
    const summary = document.querySelector('#checkout-summary');
    const shippingPrice = () => form.elements.entrega.value === 'expressa' ? 3490 : 1990;
    const renderSummary = () => {
        summary.innerHTML = `<span class="eyebrow">REVISE ANTES DE CONCLUIR</span><h2 id="checkout-summary-title">Seu pedido<span>.</span></h2><ul class="summary-items">${lines.map((line) => {
            const product = productById(line.id);
            return `<li><img src="assets/${product.image}" alt="" width="80" height="80"><div><span>${escapeText(product.name)}</span><small>${line.quantity} ${line.quantity === 1 ? 'unidade' : 'unidades'}</small></div><strong>${currency(cents(product) * line.quantity)}</strong></li>`;
        }).join('')}</ul>${orderSummary(lines, shippingPrice())}<button class="button full-button" type="submit" form="checkout-form" id="finish-order">Concluir pedido <span aria-hidden="true">↗</span></button><p class="summary-footnote">Demonstração sem cobrança. Use dados fictícios para testar.</p><a class="text-link" href="carrinho.html">← Voltar ao carrinho</a>`;
    };
    form.addEventListener('change', (event) => {
        if (event.target.name === 'entrega') renderSummary();
        if (event.target.name === 'pagamento') document.querySelector('#installments-field').hidden = form.elements.pagamento.value !== 'cartao';
    });
    form.elements.cep.addEventListener('input', (event) => {
        const digits = event.target.value.replace(/\D/g, '').slice(0, 8);
        event.target.value = digits.length > 5 ? digits.slice(0, 5) + '-' + digits.slice(5) : digits;
    });
    let finished = false;
    form.addEventListener('submit', (event) => {
        event.preventDefault();
        if (finished || !form.reportValidity()) return;
        const currentLines = getCart();
        if (JSON.stringify(currentLines) !== JSON.stringify(lines)) {
            lines = currentLines;
            if (!lines.length) {
                content.innerHTML = emptyState('O carrinho foi atualizado.', 'Adicione um produto para continuar.');
                return;
            }
            renderSummary();
            notify('O carrinho mudou em outra aba. Confira o resumo e conclua novamente.');
            return;
        }
        const order = {
            id: 'EZ-' + Array.from(crypto.getRandomValues(new Uint8Array(4)), (value) => value.toString(16).padStart(2, '0')).join('').toUpperCase(),
            createdAt: new Date().toISOString(),
            items: lines.map((line) => {
                const product = productById(line.id);
                return { id: product.id, name: product.name, image: product.image, unitPrice: cents(product), quantity: line.quantity };
            }),
            shipping: shippingPrice(),
            delivery: form.elements.entrega.value,
            payment: form.elements.pagamento.value,
            installments: form.elements.pagamento.value === 'cartao' ? Number(form.elements.parcelas.value) : 1,
            total: subtotal(lines) + shippingPrice(),
            status: 'demonstracao'
        };
        const saved = readSaved('eyeszone-orders-v2', []);
        const orders = Array.isArray(saved) ? saved : [];
        if (!writeSaved('eyeszone-orders-v2', [order, ...orders].slice(0, 20))) return;
        finished = true;
        document.querySelector('#finish-order').disabled = true;
        writeSaved('eyeszone-cart-v2', []);
        location.href = 'confirmacao.html?id=' + encodeURIComponent(order.id);
    });
    renderSummary();
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
