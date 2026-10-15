// confirmacao.html ↔ js/confirmacao.js
// JavaScript próprio desta página, sem imports de outros arquivos JS.
// O catálogo JSON é compartilhado para manter os produtos consistentes.
const catalogResponse = await fetch('./assets/catalogo.json');
if (!catalogResponse.ok) throw new Error('Não foi possível carregar o catálogo.');
const { categories, products } = await catalogResponse.json();
const findProduct = id => products.find(product => product.id === String(id));
const findCategory = id => categories.find(category => category.id === id);
const imageUrl = product => './assets/' + product.image;

// Ícones
// Ícones de interface em SVG; nenhum recurso externo é necessário.
const paths = {
  shield: '<path d="M12 3 20 6v6c0 5-8 9-8 9s-8-4-8-9V6z"/><path d="m8 12 3 3 5-6"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  cart: '<path d="M3 3h2l3 13h11l2-9H6"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/>',
  camera: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="m7 7 2-3h6l2 3"/><circle cx="12" cy="13.5" r="3.5"/>',
  bell: '<path d="M5 17h14l-2-3V9a5 5 0 0 0-10 0v5z"/><path d="M10 21h4M12 2v2"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
  truck: '<path d="M3 6h11v12H3zM14 10h4l3 4v4h-7"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
  filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  compare: '<path d="M8 4v16M16 4v16M4 8l4-4 4 4M12 16l4 4 4-4"/>',
  expand: '<path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5M3 3l6 6M21 3l-6 6M3 21l6-6M21 21l-6-6"/>',
  box: '<path d="m12 3 9 5v9l-9 5-9-5V8zM3 8l9 5 9-5M12 13v9M7 5l10 6"/>',
  receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 7h6M9 11h6M9 15h3"/>',
};
function icon(name, className = '') {
  return `<svg class="icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.info}</svg>`;
}
function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach(element => {
    element.innerHTML = icon(element.dataset.icon);
  });
}


// Formatação, quantidade e avisos
const money = value => Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const normalize = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
function breadcrumbs(items) {
  return `<nav class="breadcrumbs" aria-label="Caminho da página"><a href="index.html">Início</a>${items.map((item, index) => `${icon('chevron')}${item.href ? `<a href="${item.href}">${escapeHTML(item.label)}</a>` : `<span ${index === items.length - 1 ? 'aria-current="page"' : ''}>${escapeHTML(item.label)}</span>`}`).join('')}</nav>`;
}
function steps(active) {
  return `<ol class="steps checkout-steps" aria-label="Etapas da compra">${['Carrinho', 'Dados e pagamento', 'Confirmação'].map((name, index) => {
    const completed = index < active;
    const text = `<span class="step-number">${completed ? icon('check') : index + 1}</span><span>${name}</span>`;
    const url = index === 0 ? 'carrinho.html' : 'checkout.html';
    return `<li class="${index === active ? 'is-active' : ''} ${completed ? 'is-complete' : ''}" ${index === active ? 'aria-current="step"' : ''}>${completed ? `<a href="${url}">${text}</a>` : text}</li>`;
  }).join('')}</ol>`;
}
function quantityControl(id, value, label, max = 99) {
  return `<div class="quantity quantity-control"><button type="button" data-quantity="minus" data-id="${id}" aria-label="Diminuir quantidade de ${escapeHTML(label)}" ${value <= 1 ? 'disabled' : ''}>${icon('minus')}</button><input type="number" min="1" max="${max}" step="1" value="${value}" data-quantity-input="${id}" aria-label="Quantidade de ${escapeHTML(label)}"><button type="button" data-quantity="plus" data-id="${id}" aria-label="Aumentar quantidade de ${escapeHTML(label)}" ${value >= max ? 'disabled' : ''}>${icon('plus')}</button></div>`;
}
let toastTimer;
function toast(message, link = false) {
  const element = document.querySelector('#toast');
  const origin = document.activeElement;
  element.innerHTML = `${icon('check')}<span>${escapeHTML(message)}</span>${link ? '<a href="carrinho.html">Ver carrinho</a>' : ''}<button class="icon-button" type="button" aria-label="Fechar aviso">${icon('close')}</button>`;
  element.hidden = false;
  const dismiss = () => {
    if (element.contains(document.activeElement) && origin?.isConnected) origin.focus({ preventScroll: true });
    element.hidden = true;
    document.documentElement.style.setProperty('--notice-space', '0px');
  };
  const schedule = () => {
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { if (!element.contains(document.activeElement) && !element.matches(':hover')) dismiss(); }, 5000);
  };
  element.querySelector('button').onclick = dismiss;
  element.onfocusin = element.onmouseenter = () => clearTimeout(toastTimer);
  element.onfocusout = element.onmouseleave = schedule;
  document.documentElement.style.setProperty('--notice-space', `${element.getBoundingClientRect().height + 16}px`);
  clearTimeout(toastTimer);
  schedule();
}
function bindQuantity(root, onChange) {
  root.querySelectorAll('[data-quantity]').forEach(button => {
    button.onclick = () => {
      const input = button.parentElement.querySelector('input');
      const step = button.dataset.quantity === 'plus' ? 1 : -1;
      const value = Math.max(1, Math.min(99, (Number(input.value) || 1) + step));
      input.value = value;
      onChange(button.dataset.id, value);
      updateButtons(input);
    };
  });
  root.querySelectorAll('[data-quantity-input]').forEach(input => {
    input.onchange = () => {
      const value = Number(input.value);
      if (!Number.isInteger(value) || value < 1 || value > 99) {
        input.value = Math.max(1, Math.min(99, Math.round(value) || 1));
        toast('Escolha uma quantidade entre 1 e 99.');
      }
      onChange(input.dataset.quantityInput, Number(input.value));
      updateButtons(input);
    };
  });
}
function bindDialogTabCycle(dialog) {
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const controls = [...dialog.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex="0"]')].filter(element => element.getClientRects().length);
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
}
function updateButtons(input) {
  input.parentElement.querySelector('[data-quantity="minus"]').disabled = Number(input.value) <= 1;
  input.parentElement.querySelector('[data-quantity="plus"]').disabled = Number(input.value) >= 99;
}


// Armazenamento e continuidade entre páginas
// Carrinho/comparação: localStorage. Pedido: sessão da aba.
// Quando Storage é bloqueado, window.name transporta o estado entre os HTMLs
// desta mesma origem, sem dados de cartão, e-mail ou endereço completo.
const tabPrefix = 'EYESZONE_TAB_V1:';
function tabState() {
  try {
    const value = globalThis.window?.name || '';
    if (!value.startsWith(tabPrefix)) return {};
    const data = JSON.parse(value.slice(tabPrefix.length));
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  } catch { return {}; }
}
function writeTab(key, value) {
  try {
    if (!globalThis.window) return;
    const state = tabState();
    state[key] = value;
    window.name = tabPrefix + JSON.stringify(state);
  } catch { /* A página atual continua utilizável. */ }
}
function readStored(key, fallback = []) {
  try {
    if (!globalThis.localStorage) return tabState()[key] ?? fallback;
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch { return tabState()[key] ?? fallback; }
}
function writeStored(key, value) {
  try {
    if (!globalThis.localStorage) { writeTab(key, value); return; }
    localStorage.setItem(key, JSON.stringify(value));
  } catch { writeTab(key, value); }
}
function readSession(key) {
  try {
    const value = globalThis.sessionStorage?.getItem(key);
    return value ? JSON.parse(value) : tabState()[key] ?? null;
  } catch { return tabState()[key] ?? null; }
}
function writeSession(key, value) {
  try {
    if (!globalThis.sessionStorage) { writeTab(key, value); return; }
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch { writeTab(key, value); }
}


// Carrinho e pedido local
const cartKey = 'eyeszone.cart.v1';
function validCart(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value.filter(item => {
    if (!item || typeof item.id !== 'string' || !findProduct(item.id) || seen.has(item.id) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) return false;
    seen.add(item.id);
    return true;
  }).map(({ id, quantity }) => ({ id, quantity }));
}
let cart = validCart(readStored(cartKey));
const orderKey = 'eyeszone.order.v1';
function validOrder(value) {
  if (!value || typeof value !== 'object' || !/^EZ-[0-9]{8}$/.test(value.id) || !Number.isFinite(Date.parse(value.date))) return null;
  if (typeof value.name !== 'string' || typeof value.city !== 'string' || !/^[A-Z]{2}$/.test(value.state) || !['Pix', 'Cartão'].includes(value.payment)) return null;
  const items = validCart(value.items).map(item => ({ ...item, product: findProduct(item.id) }));
  if (!items.length) return null;
  const subtotal = Math.round(items.reduce((sum, item) => sum + item.quantity * item.product.price, 0) * 100) / 100;
  return { id: value.id, date: value.date, name: value.name.slice(0, 100), city: value.city.slice(0, 80), state: value.state,
    payment: value.payment, status: 'in_transit', items, subtotal, shipping: 19.90, total: Math.round((subtotal + 19.90) * 100) / 100 };
}
let lastOrder = validOrder(readSession(orderKey));
const subscribers = new Set();
const shippingPrice = 19.90;
const getCart = () => cart.map(item => ({ ...item, product: findProduct(item.id) }));
const cartCount = () => cart.reduce((sum, item) => sum + item.quantity, 0);
const subtotal = () => Math.round(cart.reduce((sum, item) => sum + findProduct(item.id).price * item.quantity, 0) * 100) / 100;
const orderTotal = () => Math.round((subtotal() + (cart.length ? shippingPrice : 0)) * 100) / 100;
const getOrder = () => lastOrder;
function subscribe(callback) { subscribers.add(callback); return () => subscribers.delete(callback); }
function notifyCart() { writeStored(cartKey, cart); subscribers.forEach(callback => callback()); }
function addToCart(id, quantity = 1) {
  if (!findProduct(id) || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) return false;
  const existing = cart.find(item => item.id === String(id));
  if (existing && existing.quantity + quantity > 99) return false;
  if (existing) existing.quantity += quantity;
  else cart.push({ id: String(id), quantity });
  notifyCart();
  return true;
}
function updateQuantity(id, quantity) {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) return false;
  const item = cart.find(item => item.id === String(id));
  if (!item) return false;
  item.quantity = quantity;
  notifyCart();
  return true;
}
function removeFromCart(id) {
  cart = cart.filter(item => item.id !== String(id));
  notifyCart();
}
function createOrder(details) {
  if (!cart.length) return null;
  lastOrder = {
    id: `EZ-${String(Date.now()).slice(-8)}`,
    date: new Date().toISOString(),
    name: details.name,
    city: details.city,
    state: details.state,
    payment: details.payment,
    status: 'in_transit',
    items: getCart(),
    subtotal: subtotal(),
    shipping: shippingPrice,
    total: orderTotal(),
  };
  writeSession(orderKey, { ...lastOrder, items: lastOrder.items.map(({ id, quantity }) => ({ id, quantity })) });
  cart = [];
  notifyCart();
  return lastOrder;
}


// Seleção para comparação
const key = 'eyeszone.compare.v1';
function validComparison(value) {
  return Array.isArray(value) ? [...new Set(value.filter(id => typeof id === 'string' && findProduct(id)))].slice(0, 3) : [];
}
let selected = validComparison(readStored(key));
const listeners = new Set();
const comparisonIds = () => [...selected];
const comparedProducts = () => selected.map(findProduct);
const subscribeComparison = callback => { listeners.add(callback); return () => listeners.delete(callback); };
function notifyComparison() { writeStored(key, selected); listeners.forEach(callback => callback()); }
function toggleComparison(id) {
  if (typeof id !== 'string' || !findProduct(id)) return false;
  if (selected.includes(id)) selected = selected.filter(item => item !== id);
  else if (selected.length < 3) selected.push(id);
  else return false;
  notifyComparison();
  return true;
}
function clearComparison() { selected = []; notifyComparison(); }
function compareButton(product) {
  const active = selected.includes(product.id);
  return `<button type="button" class="compare compare-toggle" data-compare="${product.id}" aria-pressed="${active}" aria-label="${active ? 'Selecionado para comparar:' : 'Comparar'} ${escapeHTML(product.name)}">${icon('compare')}<span>${active ? 'Selecionado' : 'Comparar'}</span></button>`;
}
function bindComparisonUI(root, onPageChange) {
  const dock = root.querySelector('#comparison-dock');
  const count = root.querySelector('#comparison-count');
  const hint = root.querySelector('#comparison-hint');
  const go = root.querySelector('#open-comparison');
  function update() {
    const items = comparisonIds();
    root.querySelectorAll('[data-compare]').forEach(button => {
      const active = items.includes(button.dataset.compare);
      button.setAttribute('aria-pressed', String(active));
      button.setAttribute('aria-label', `${active ? 'Selecionado para comparar:' : 'Comparar'} ${findProduct(button.dataset.compare).name}`);
      button.querySelector('span').textContent = active ? 'Selecionado' : 'Comparar';
    });
    dock.hidden = !items.length || ['comparar', 'carrinho', 'checkout', 'confirmacao', 'pedido'].includes(location.pathname.split('/').pop().replace(/\.html$/, ''));
    count.textContent = `${items.length} de 3 produtos`;
    hint.textContent = items.length < 2 ? 'Selecione mais um para comparar.' : 'Veja as diferenças antes de escolher.';
    go.disabled = items.length < 2;
    root.documentElement.style.setProperty('--comparison-space', dock.hidden ? '0px' : `${dock.getBoundingClientRect().height}px`);
  }
  root.addEventListener('click', event => {
    const toggle = event.target.closest('[data-compare]');
    if (toggle && !toggleComparison(toggle.dataset.compare)) toast('Compare até 3 produtos. Remova um para escolher outro.');
    const remove = event.target.closest('[data-remove-comparison]');
    if (remove) toggleComparison(remove.dataset.removeComparison);
    if (event.target.closest('[data-clear-comparison]')) clearComparison();
  });
  go.onclick = () => { location.href = 'comparar.html'; };
  subscribeComparison(() => { onPageChange(); update(); });
  if (globalThis.ResizeObserver) new ResizeObserver(update).observe(dock);
  update();
  return { update };
}


// Cards e resumo

function productCard(product, variant = '') {
  return `<article class="card product-card ${variant}" data-product-id="${product.id}">
    <a class="card-link" href="produto.html?id=${product.id}">
      <div class="photo product-card-image ${product.photoStyle ? 'photo-' + product.photoStyle : ''}"><span class="code">EZ / ${product.id.padStart(2, '0')}</span><img src="${imageUrl(product)}" data-product-image data-asset-id="eyeszone-product-${product.id}" alt="" loading="${variant === 'feature' ? 'eager' : 'lazy'}" ${variant === 'feature' ? 'fetchpriority="high"' : ''} width="400" height="320"><span class="image-fallback" hidden>Imagem indisponível</span></div>
      <div class="card-copy"><h3>${escapeHTML(product.name)}</h3><p>${escapeHTML(product.short)}</p><strong class="price">${money(product.price)}</strong></div>
    </a>${compareButton(product)}
  </article>`;
}
function sectionHeading(number, title, count = '') {
  return `<div class="section-head"><div class="heading-title"><img src="./assets/department-bracket.svg" data-asset-id="eyeszone-department-bracket" alt="" width="28" height="28">${number ? `<span class="department-number" aria-hidden="true">${number}</span>` : ''}<h2>${escapeHTML(title)}</h2></div>${count ? `<span class="result-count">${count} equipamentos</span>` : ''}</div>`;
}
function categoryCard(category, index = 0) {
  const count = products.filter(p => p.category === category.id).length;
  return `<a href="categoria.html?categoria=${category.id}" class="category-card"><span class="department-number" aria-hidden="true">0${index + 1}</span><img src="./assets/${category.image}" alt="" width="250" height="200"><h2>${escapeHTML(category.name)}</h2><p>${count} equipamentos</p>${icon('chevron')}</a>`;
}
function emptyState({ symbol = 'cart', title, description, href = 'produtos.html', action = 'Ver equipamentos', headingLevel = 1, actionId = '' }) {
  return `<section class="empty empty-state">${icon(symbol)}<h${headingLevel}>${escapeHTML(title)}</h${headingLevel}><p>${escapeHTML(description)}</p>${actionId ? `<button class="primary button" type="button" id="${actionId}">${escapeHTML(action)}</button>` : `<a class="primary button" href="${href}">${escapeHTML(action)}</a>`}</section>`;
}
function summary({ checkout = false } = {}) {
  return `<aside class="summary order-summary panel" aria-label="Resumo da compra"><h2>Resumo da compra</h2>
    ${checkout ? `<div class="summary-products">${getCart().map(item => `<div class="summary-item summary-product"><img src="${imageUrl(item.product)}" alt="" width="60" height="60"><span>${escapeHTML(item.product.name)}<small>${item.quantity} ${item.quantity === 1 ? 'unidade' : 'unidades'}</small></span><strong>${money(item.product.price * item.quantity)}</strong></div>`).join('')}</div>` : ''}
    <dl class="totals summary-totals"><div><dt>Subtotal (${cartCount()} ${cartCount() === 1 ? 'item' : 'itens'})</dt><dd>${money(subtotal())}</dd></div><div><dt>Entrega padrão</dt><dd>${money(shippingPrice)}</dd></div><div class="total summary-total"><dt>Total</dt><dd>${money(orderTotal())}</dd></div></dl>
    <small>A instalação não está incluída.</small>
    ${checkout ? '' : '<a class="primary button" href="checkout.html">Continuar para checkout ' + icon('chevron') + '</a>'}
  </aside>`;
}


// Catálogo e filtros

function filteredProducts({ category, query = '', maxPrice = '', sort = 'default' }) {
  const terms = normalize(query).trim().split(/\s+/).filter(Boolean);
  const list = products.filter(product => {
    const text = normalize([product.name, findCategory(product.category).name, product.description, product.short, product.application].join(' '));
    return (!category || product.category === category) && terms.every(term => text.includes(term)) && (maxPrice === '' || product.price <= Number(maxPrice));
  });
  if (sort === 'price-up') list.sort((a, b) => a.price - b.price);
  if (sort === 'price-down') list.sort((a, b) => b.price - a.price);
  if (sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  return list;
}
function catalogPage(options) {
  const { category = '', query = '', maxPrice = '', sort = 'default', search = false } = options;
  const categoryData = findCategory(category);
  const title = search ? (query ? `Resultados para “${query}”` : 'Buscar produtos') : categoryData?.name || 'Todos os equipamentos';
  const list = filteredProducts(options);
  const hasFilters = Boolean(category || maxPrice !== '' || sort !== 'default');
  return `${breadcrumbs([{ label: title }])}<div class="page-title page-heading catalog-heading"><div><h1>${escapeHTML(title)}</h1><p>${search ? 'Equipamentos encontrados no catálogo da loja.' : 'Fotografia, aplicação e preço para escolher com clareza.'}</p></div></div>
    <div class="catalog-layout"><div class="catalog-results"><div class="catalog-bar results-toolbar"><p><b>${list.length}</b> ${list.length === 1 ? 'equipamento' : 'equipamentos'}</p><label><span>Ordenar por</span><select id="catalog-sort" aria-label="Ordenar produtos"><option value="default">Seleção da loja</option><option value="price-up" ${sort === 'price-up' ? 'selected' : ''}>Menor preço</option><option value="price-down" ${sort === 'price-down' ? 'selected' : ''}>Maior preço</option><option value="name" ${sort === 'name' ? 'selected' : ''}>Nome do produto</option></select></label></div>
    <details class="filters filter-box" open><summary>${icon('filter')}<strong>Filtros</strong>${maxPrice !== '' ? `<span>Até ${money(maxPrice)}</span>` : ''}${icon('chevron', 'filter-toggle')}</summary><form id="catalog-filters" class="filter-fields"><label>Departamento<select name="category" aria-label="Departamento"><option value="" ${!category ? 'selected' : ''}>Todos os departamentos (${products.length})</option>${categories.map(c => `<option value="${c.id}" ${category === c.id ? 'selected' : ''}>${escapeHTML(c.name)} (${products.filter(p => p.category === c.id).length})</option>`).join('')}</select></label><label>Preço máximo (R$)<input name="maxPrice" type="number" min="0" step="0.01" inputmode="decimal" value="${escapeHTML(maxPrice)}" placeholder="Qualquer valor"></label><button class="primary button" type="submit">Aplicar filtros</button>${list.length ? '<button class="plain filter-clear" type="button" id="clear-filters">Limpar</button>' : ''}</form></details>
    ${maxPrice !== '' ? `<p class="active-filter">Preço máximo: ${money(maxPrice)} ${list.length ? '<button class="plain" type="button" data-clear-max>Remover filtro</button>' : ''}</p>` : ''}
    ${list.length ? `<div class="product-grid catalog-grid">${list.map(product => productCard(product)).join('')}</div>` : emptyState({ symbol: 'search', headingLevel: 2, title: hasFilters ? 'Nenhum equipamento com estes filtros' : 'Não encontramos esse produto', description: hasFilters ? 'Ajuste o preço máximo ou escolha outro departamento.' : 'Tente câmera, alarme ou fechadura, ou consulte o catálogo.', action: hasFilters ? 'Limpar filtros' : 'Ver equipamentos', actionId: hasFilters ? 'clear-filters' : '' })}</div></div>`;
}


// Busca do cabeçalho
function searchSuggestions(query) {
  const term = normalize(query).trim();
  if (term.length < 2) return [];
  const relevance = product => {
    const name = normalize(product.name);
    if (name === term) return 0;
    if (name.startsWith(term)) return 1;
    if (name.includes(term)) return 2;
    if (normalize(findCategory(product.category).name).includes(term)) return 3;
    return 4;
  };
  return filteredProducts({ query }).sort((a, b) => relevance(a) - relevance(b)).slice(0, 5);
}
function bindSearch(root) {
  const area = root.querySelector('.search-area');
  const form = root.querySelector('#site-search');
  const input = form.querySelector('input');
  const panel = root.querySelector('#search-panel');
  const list = root.querySelector('#search-suggestions');
  const status = root.querySelector('#search-status');
  let results = [];
  let active = -1;
  function close() {
    panel.hidden = true;
    active = -1;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  }
  function select(index) {
    active = index;
    list.querySelectorAll('[role="option"]').forEach((item, i) => item.setAttribute('aria-selected', String(i === active)));
    if (index >= 0) {
      const item = list.children[index];
      input.setAttribute('aria-activedescendant', item.id);
      item.scrollIntoView({ block: 'nearest' });
    } else input.removeAttribute('aria-activedescendant');
  }
  function open() {
    results = searchSuggestions(input.value);
    active = -1;
    input.removeAttribute('aria-activedescendant');
    if (input.value.trim().length < 2) { close(); return; }
    list.innerHTML = results.map((product, index) => `<li id="suggestion-${product.id}" role="option" aria-selected="false" data-suggestion="${index}"><img src="${imageUrl(product)}" alt="" width="48" height="48"><span><strong>${escapeHTML(product.name)}</strong><small>${escapeHTML(product.short)}</small></span><b>${money(product.price)}</b></li>`).join('');
    status.textContent = results.length ? `${results.length} sugestões. Use as setas para escolher e Enter para abrir.` : 'Nenhum produto encontrado. Tente câmera, alarme ou fechadura.';
    panel.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }
  function visit(index) {
    if (!results[index]) return;
    location.href = `produto.html?id=${results[index].id}`;
    close();
    input.blur();
  }
  input.addEventListener('input', open);
  input.addEventListener('focus', open);
  input.addEventListener('keydown', event => {
    if (event.isComposing) return;
    if (event.key === 'Escape') { if (!panel.hidden) event.preventDefault(); close(); return; }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (panel.hidden) open();
      if (!results.length) return;
      event.preventDefault();
      select(event.key === 'ArrowDown' ? (active + 1) % results.length : (active <= 0 ? results.length - 1 : active - 1));
    } else if (event.key === 'Enter' && !panel.hidden && active >= 0) {
      event.preventDefault();
      visit(active);
    } else if (event.key === 'Tab') close();
  });
  list.addEventListener('click', event => {
    const option = event.target.closest('[data-suggestion]');
    if (option) visit(Number(option.dataset.suggestion));
  });
  root.addEventListener('pointerdown', event => { if (!area.contains(event.target)) close(); });
  form.addEventListener('submit', close);
  return { close };
}


// Informações do rodapé
const content = {
  escolha: {
    title: 'Como escolher sua solução',
    body: '<p>Comece pelo espaço que você quer proteger e pela sua principal necessidade.</p><ul><li><strong>Câmeras:</strong> para acompanhar ambientes e pontos de circulação.</li><li><strong>Alarmes:</strong> para compor a proteção dos pontos de entrada.</li><li><strong>Controle de acesso:</strong> para organizar a entrada de pessoas.</li><li><strong>Gravação:</strong> para reunir e armazenar as imagens das câmeras.</li></ul><p>Na página do produto, confira a aplicação e as orientações de compatibilidade antes de comprar.</p>',
  },
  instalacao: {
    title: 'Instalação e compatibilidade',
    body: '<p>Confira as condições do seu ambiente antes de escolher um equipamento.</p><ul><li>Verifique alimentação, conexão e acessórios necessários.</li><li>Confirme a compatibilidade com gravadores, aplicativos ou outros dispositivos.</li><li>Em fechaduras, confira dimensões, material e sentido de abertura da porta.</li><li>Para áreas externas, confirme a proteção contra água e poeira.</li></ul><p>A instalação não está incluída no preço dos equipamentos. Procure orientação de um profissional para definir a montagem adequada.</p>',
  },
  entrega: {
    title: 'Entrega e pagamento',
    body: '<p>Confira o valor da entrega no resumo do carrinho e revise o endereço antes de concluir seu pedido.</p><p>Escolha entre Pix e cartão no checkout. Depois de confirmar, acesse Acompanhar pedido para consultar as etapas da entrega e o destino dos equipamentos.</p><p>A instalação, acessórios adicionais e eventuais assinaturas são considerados separadamente.</p>',
  },
  sobre: {
    title: 'Sobre a EYESZONE',
    body: '<p>A EYESZONE conecta você a soluções de tecnologia para segurança, com câmeras, alarmes e equipamentos de controle de acesso.</p><p>Nosso propósito é ajudar pessoas e pequenos negócios a escolher uma proteção adequada ao seu espaço, com informações claras e uma experiência de compra simples.</p>',
  },
  contato: {
    title: 'Contato',
    body: '<p>Nosso canal de atendimento será disponibilizado em breve.</p><p>Enquanto isso, consulte as orientações de escolha e instalação no rodapé e as informações de compatibilidade na página de cada produto.</p>',
  },
  privacidade: {
    title: 'Privacidade',
    body: '<p>Este site não envia os dados do checkout a um servidor e não solicita dados bancários. As informações preenchidas são utilizadas somente para exibir o resumo da compra durante sua navegação.</p><p>O resumo do último pedido permanece na sessão desta aba para você consultar a confirmação e a entrega. E-mail, rua e demais campos do endereço não são gravados. Apenas os códigos e as quantidades dos produtos do carrinho e a seleção de comparação ficam salvos neste navegador. Você pode removê-los pelo carrinho e pelo botão Limpar da comparação. Não há ferramentas de rastreamento ou anúncios integradas.</p>',
  },
};
function bindInfoDialogs() {
  const dialog = document.querySelector('#info-dialog');
  bindDialogTabCycle(dialog);
  document.addEventListener('click', event => {
    const trigger = event.target.closest('[data-info]');
    if (trigger) {
      const entry = content[trigger.dataset.info];
      if (!entry) return;
      document.querySelector('#dialog-title').textContent = entry.title;
      document.querySelector('#dialog-body').innerHTML = entry.body;
      dialog.showModal();
    }
    if (event.target.closest('[data-close-dialog]')) dialog.close();
  });
  dialog.addEventListener('click', event => {
    if (event.target === dialog) {
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    }
  });
}


// Menu e filtros no celular
// Mantém a navegação e os filtros coerentes ao redimensionar ou girar a tela.
function bindResponsiveUI(root, media) {
  const button = root.querySelector('#category-menu');
  const navigation = root.querySelector('#category-navigation');
  let menuOpen = false;

  function updateNavigation() {
    const expanded = !media.matches || menuOpen;
    navigation.dataset.open = String(expanded);
    button.setAttribute('aria-expanded', String(expanded));
  }
  function closeNavigation() {
    menuOpen = false;
    updateNavigation();
  }
  function refresh() {
    closeNavigation();
    const filters = root.querySelector('.filter-box');
    if (filters) filters.open = !media.matches;
  }
  button.addEventListener('click', () => {
    if (!media.matches) return;
    menuOpen = !menuOpen;
    updateNavigation();
  });
  function handleEscape(event) {
    if (event.key === 'Escape' && media.matches && menuOpen) {
      event.preventDefault();
      closeNavigation();
      button.focus();
    }
  }
  button.addEventListener('keydown', handleEscape);
  navigation.addEventListener('keydown', handleEscape);
  media.addEventListener('change', refresh);
  refresh();
  return { refresh };
}


// Galeria
function bindGallery(root) {
  const dialog = root.querySelector('#image-dialog');
  const image = root.querySelector('#expanded-product-image');
  const title = root.querySelector('#image-dialog-title');
  const zoom = root.querySelector('#image-zoom');
  const viewport = root.querySelector('.image-viewer');
  bindDialogTabCycle(dialog);
  function reset() {
    viewport.classList.remove('is-zoomed');
    zoom.setAttribute('aria-pressed', 'false');
    zoom.textContent = 'Ampliar 2×';
    viewport.scrollTop = viewport.scrollLeft = 0;
  }
  root.addEventListener('click', event => {
    const trigger = event.target.closest('[data-zoom-product]');
    if (trigger) {
      const product = findProduct(trigger.dataset.zoomProduct);
      if (!product) return;
      image.src = imageUrl(product);
      image.alt = product.name;
      title.textContent = product.name;
      reset();
      dialog.showModal();
    }
    if (event.target.closest('[data-close-image]')) dialog.close();
  });
  zoom.onclick = () => {
    const expanded = viewport.classList.toggle('is-zoomed');
    zoom.setAttribute('aria-pressed', String(expanded));
    zoom.textContent = expanded ? 'Ajustar à tela' : 'Ampliar 2×';
    viewport.scrollLeft = expanded ? (viewport.scrollWidth - viewport.clientWidth) / 2 : 0;
    viewport.scrollTop = expanded ? (viewport.scrollHeight - viewport.clientHeight) / 2 : 0;
  };
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
}


// Etapas do pedido

const stages = [
  { id: 'confirmed', title: 'Pedido confirmado', detail: 'Recebemos seu pedido e reunimos os detalhes da compra.' },
  { id: 'prepared', title: 'Equipamentos separados', detail: 'Os equipamentos foram preparados para o transporte.' },
  { id: 'in_transit', title: 'A caminho', detail: 'Seu pedido está em transporte para o endereço informado.' },
  { id: 'delivered', title: 'Entregue', detail: 'Recebimento do pedido no endereço de destino.' },
];
function orderProgress(order) {
  const index = stages.findIndex(stage => stage.id === order.status);
  const current = index < 0 ? 2 : index;
  return { current, title: stages[current].title, stages };
}


// Confirmação do pedido
function confirmationPage() {
  const order = getOrder();
  if (!order) return emptyState({ symbol: 'receipt', title: 'Seu próximo pedido começa aqui', description: 'Explore os produtos e escolha a proteção para o seu espaço.' });
  return `${steps(2)}<section class="confirmation"><div class="confirmation-title"><span class="success-mark">${icon('check')}</span><div><span class="overline">PEDIDO ${escapeHTML(order.id)}</span><h1>Pedido confirmado.</h1><p>${escapeHTML(order.name.split(' ')[0])}, seus equipamentos estão a caminho de ${escapeHTML(order.city)}.</p></div></div><span class="status-tag order-status">${icon('truck')}${orderProgress(order).title}</span>
    <div class="confirmation-body confirmation-panel"><div class="confirmation-products">${order.items.map(item => `<div class="confirmation-item confirmation-product"><img src="${imageUrl(item.product)}" alt="" width="95" height="85"><span><strong>${escapeHTML(item.product.name)}</strong><small>${item.quantity} ${item.quantity === 1 ? 'unidade' : 'unidades'}</small></span><strong>${money(item.product.price * item.quantity)}</strong></div>`).join('')}</div><div><dl class="totals summary-totals"><div><dt>Subtotal</dt><dd>${money(order.subtotal)}</dd></div><div><dt>Entrega</dt><dd>${money(order.shipping)}</dd></div><div class="total summary-total"><dt>Total do pedido</dt><dd>${money(order.total)}</dd></div></dl><dl class="order-meta confirmation-meta"><div><dt>Destino</dt><dd>${escapeHTML(order.city)} / ${escapeHTML(order.state)}</dd></div><div><dt>Forma de pagamento</dt><dd>${escapeHTML(order.payment)}</dd></div><div><dt>Data</dt><dd>${new Date(order.date).toLocaleDateString('pt-BR')}</dd></div></dl></div></div><div class="confirmation-actions"><a class="primary button" href="pedido.html?id=${escapeHTML(order.id)}">Acompanhar pedido ${icon('chevron')}</a><a class="plain" href="produtos.html">Voltar à loja</a></div></section>`;
}

// Esta inicialização atende somente confirmacao.html; não existe roteador.
const pageName = 'confirmacao';

function renderPage() {
  const main = document.querySelector('#main');
  main.innerHTML = confirmationPage();

  document.title = (pageName === 'index' ? 'Segurança sob seu controle' : main.querySelector('h1')?.textContent || 'Meu pedido') + ' | EYESZONE';
}
function departmentNavigation() {
  return categories.map((category, index) => {
    const count = products.filter(product => product.category === category.id).length;
    return `<a href="categoria.html?categoria=${category.id}" data-nav="${category.id}"><span class="department-number" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span><strong>${escapeHTML(category.name)}</strong><small>${count} equipamentos</small>${icon('chevron')}</a>`;
  }).join('') + `<a class="all" href="produtos.html" data-nav="all">Todos os equipamentos <b>${products.length}</b></a>`;
}

// Movimento discreto da fotografia, apenas com mouse e sem redução de movimento.
function bindProductHover(root = document) {
  const mouse = window.matchMedia('(hover: hover) and (pointer: fine)');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const selector = '.photo, .product-photo';
  const enabled = () => mouse.matches && !reduced.matches;
  function reset(photo) {
    photo.removeAttribute('data-hover');
    photo.style.removeProperty('--pointer-x');
    photo.style.removeProperty('--pointer-y');
    photo.style.removeProperty('--tilt-x');
    photo.style.removeProperty('--tilt-y');
  }
  root.addEventListener('pointerover', event => {
    const photo = event.target.closest(selector);
    if (photo && enabled() && event.pointerType === 'mouse') photo.dataset.hover = 'true';
  });
  root.addEventListener('pointermove', event => {
    const photo = event.target.closest(selector);
    if (!photo || !enabled() || event.pointerType !== 'mouse') return;
    const bounds = photo.getBoundingClientRect();
    const x = Math.max(-1, Math.min(1, (event.clientX - bounds.left) / bounds.width * 2 - 1));
    const y = Math.max(-1, Math.min(1, (event.clientY - bounds.top) / bounds.height * 2 - 1));
    photo.style.setProperty('--pointer-x', (x * 5).toFixed(2) + 'px');
    photo.style.setProperty('--pointer-y', (y * 5).toFixed(2) + 'px');
    photo.style.setProperty('--tilt-x', (-y * 2).toFixed(2) + 'deg');
    photo.style.setProperty('--tilt-y', (x * 2).toFixed(2) + 'deg');
  });
  root.addEventListener('pointerout', event => {
    const photo = event.target.closest(selector);
    if (photo && (!event.relatedTarget || !photo.contains(event.relatedTarget))) reset(photo);
  });
  const clear = () => root.querySelectorAll(selector + '[data-hover]').forEach(reset);
  mouse.addEventListener('change', clear);
  reduced.addEventListener('change', clear);
  window.addEventListener('blur', clear);
}

function startPage() {
  const main = document.querySelector('#main');
  renderPage();
  document.querySelector('#category-navigation').innerHTML = departmentNavigation();
  hydrateIcons();
  bindProductHover(document);
  const responsiveUI = bindResponsiveUI(document, window.matchMedia('(max-width: 760px)'));
  bindInfoDialogs();
  bindGallery(document);
  bindSearch(document);
  bindComparisonUI(document, () => {
    // O estado dos botões é atualizado pela seleção.
  });
  document.addEventListener('error', event => {
    const image = event.target;
    if (!(image instanceof HTMLImageElement) || !image.hasAttribute('data-product-image')) return;
    const fallback = image.parentElement.querySelector('.image-fallback');
    if (fallback) { fallback.hidden = false; image.hidden = true; }
  }, true);
  const category = pageName === 'categoria' ? new URLSearchParams(location.search).get('categoria') : pageName === 'produto' ? findProduct(new URLSearchParams(location.search).get('id') || '1')?.category : '';
  document.querySelectorAll('[data-nav]').forEach(link => {
    const active = link.dataset.nav === category || (pageName === 'produtos' && link.dataset.nav === 'all');
    link.classList.toggle('current', active);
    if (active) link.setAttribute('aria-current', pageName === 'produto' ? 'true' : 'page');
    else link.removeAttribute('aria-current');
  });
  function updateCartCount() {
    const count = cartCount();
    const badge = document.querySelector('#cart-count');
    badge.textContent = count;
    badge.setAttribute('aria-label', count + (count === 1 ? ' item' : ' itens'));
  }
  subscribe(updateCartCount);
  updateCartCount();
  document.querySelector('#year').textContent = new Date().getFullYear();
  document.querySelector('.skip-link').onclick = event => {
    event.preventDefault();
    main.focus({ preventScroll: true });
    main.scrollIntoView({ block: 'start' });
  };
  // Voltar/avançar pode recuperar um documento do cache do navegador.
  window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
  responsiveUI.refresh();
  document.documentElement.dataset.ready = 'true';
}
if (typeof document !== 'undefined') startPage();
