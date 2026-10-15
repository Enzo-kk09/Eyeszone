import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPage } from './test-support.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const htmls = readdirSync(root).filter(name => name.endsWith('.html')).sort();
const scripts = readdirSync(path.join(root, 'js')).filter(name => name.endsWith('.js')).sort();
assert.equal(htmls.length, 12);
assert.deepEqual(scripts, htmls.map(name => name.replace('.html', '.js')).sort());
for (const file of readdirSync(path.join(root, 'js')).filter(name => /\.(m?js)$/.test(name))) {
  const result = spawnSync(process.execPath, ['--check', path.join(root, 'js', file)], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
}
for (const html of htmls) {
  const source = readFileSync(path.join(root, html), 'utf8');
  const entry = html.replace('.html', '.js');
  assert.equal((source.match(/<script\b/g) || []).length, 1, html);
  assert.ok(source.includes(`src="./js/${entry}"`), html);
  assert.ok(/<main\b[\s\S]+?<h1>/.test(source), `Conteúdo ausente: ${html}`);
  assert.ok(!source.includes('#/'), `Rota SPA em ${html}`);
  for (const [, href] of source.matchAll(/(?:href|src)="([^"#]+)"/g)) {
    assert.ok(existsSync(path.resolve(root, href.split('?')[0])), `${html}: ${href}`);
  }
  const js = readFileSync(path.join(root, 'js', entry), 'utf8');
  assert.ok(!/^import\s/m.test(js), `Dependência JS em ${entry}`);
  assert.ok(!/hashchange|location\.hash|#\//.test(js), `Roteador em ${entry}`);
}
const saved = new Map(), session = new Map();
globalThis.localStorage = { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) };
globalThis.sessionStorage = { getItem: key => session.get(key) ?? null, setItem: (key, value) => session.set(key, value) };
const home = await loadPage('index');
const { products, categories, filteredProducts, catalogPage } = home;
assert.equal(products.length, 23);
assert.equal(categories.length, 4);
assert.equal(new Set(products.map(product => product.id)).size, 23);
const productPage = (await loadPage('produto')).productPage;
for (const product of products) {
  assert.ok(existsSync(path.join(root, 'assets', product.image)));
  assert.ok(categories.some(category => category.id === product.category));
  assert.ok(product.price > 0);
  assert.ok(productPage(product.id).includes(product.name));
}
assert.equal(filteredProducts({ category: 'cameras' }).length, 6);
assert.equal(filteredProducts({ category: 'gravacao' }).length, 4);
assert.equal(filteredProducts({ query: 'biometrico' }).length, 2);
assert.equal(filteredProducts({ query: 'fechadura digital' }).length, 3);
assert.equal(filteredProducts({ query: 'produto inexistente' }).length, 0);
assert.ok(filteredProducts({ maxPrice: '200' }).every(product => product.price <= 200));
assert.equal(filteredProducts({ sort: 'price-up' })[0].id, '13');
assert.equal(filteredProducts({ sort: 'price-down' })[0].id, '21');
assert.equal((home.homePage().match(/class="card-link"/g) || []).length, 23);
assert.equal((home.homePage().match(/data-compare=/g) || []).length, 23);
for (const product of products) assert.ok(home.homePage().includes(`data-product-id="${product.id}"`));
for (const product of products.slice(13)) {
  assert.ok(product.source.url.startsWith('https://'));
  assert.ok(product.source.imageUrl.startsWith('https://'));
  assert.ok(productPage(product.id).includes('Ficha do fabricante'));
}
assert.ok((await loadPage('categorias')).categoriesPage().includes('Controle de acesso'));
assert.ok(catalogPage({ query: '<img onerror=alert(1)>', search: true }).includes('&lt;img'));
const cart = await loadPage('carrinho');
assert.ok(cart.cartPage().includes('Seu carrinho está vazio'));
assert.ok((await loadPage('checkout')).checkoutPage().includes('Escolha seus produtos primeiro'));
assert.ok((await loadPage('pedido')).orderPage().includes('Nenhum pedido para acompanhar'));
assert.equal(cart.addToCart('unknown', 1), false);
assert.equal(cart.addToCart('1', 0), false);
assert.equal(cart.addToCart('1', 2), true);
assert.equal(cart.cartCount(), 2);
assert.equal(cart.subtotal(), 379.8);
assert.equal(cart.orderTotal(), 399.7);
assert.equal(cart.updateQuantity('1', 3), true);
assert.equal(cart.updateQuantity('1', 1.5), false);
assert.equal(cart.addToCart('1', 99), false);
assert.equal(cart.addToCart('8', 1), true);
cart.removeFromCart('8');
assert.equal(cart.getCart().length, 1);
const checkout = await loadPage('checkout');
assert.ok(checkout.checkoutPage().includes('checkout-form'));
const order = checkout.createOrder({ name: '<Teste>', city: 'Campinas', state: 'SP', payment: 'Pix' });
assert.equal(order.total, 589.6);
assert.equal(checkout.cartCount(), 0);
assert.equal(order.status, 'in_transit');
const tracking = await loadPage('pedido');
assert.equal(tracking.orderProgress(order).current, 2);
assert.equal(tracking.orderProgress({ status: 'delivered' }).title, 'Entregue');
assert.ok(tracking.orderPage(order.id).includes('aria-current="step"'));
assert.ok(tracking.orderPage('unknown').includes('Nenhum pedido para acompanhar'));
const confirmation = await loadPage('confirmacao');
assert.ok(confirmation.confirmationPage().includes(`pedido.html?id=${order.id}`));
assert.ok(confirmation.confirmationPage().includes('&lt;Teste&gt;'));
assert.equal(confirmation.getOrder().items[0].quantity, 3);
assert.equal((await loadPage('carrinho')).cartCount(), 0);
const recovered = tracking.validOrder({ ...order, total: 1, items: [{ id: '1', quantity: 3, price: 1 }] });
assert.equal(recovered.total, 589.6);
assert.equal(tracking.validOrder({ ...order, items: [{ id: 'unknown', quantity: 1 }] }), null);
assert.ok(![...saved.values()].join('').includes('Campinas'));
console.log('OK: 12 pares HTML/JS independentes, links, catálogo, filtros, carrinho e pedido entre páginas.');
