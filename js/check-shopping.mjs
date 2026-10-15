import assert from 'node:assert/strict';
import { loadPage } from './test-support.mjs';
const saved = new Map();
const storage = { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) };
globalThis.localStorage = storage;
saved.set('eyeszone.cart.v1', JSON.stringify([{ id: '1', quantity: 2, price: 1 }, { id: '1', quantity: 5 }, { id: 'unknown', quantity: 1 }, { id: '2', quantity: 100 }, { id: '3', quantity: -1 }]));
const cart = await loadPage('carrinho');
assert.equal(cart.cartCount(), 2);
assert.equal(cart.subtotal(), 379.8); // Preço sempre vem do catálogo, nunca do armazenamento.
assert.deepEqual(cart.validCart(null), []);
assert.deepEqual(cart.validCart([null, {}, { id: '1', quantity: 1.5 }]), []);
assert.equal(cart.addToCart('2', 1), true);
assert.deepEqual(JSON.parse(saved.get('eyeszone.cart.v1')), [{ id: '1', quantity: 2 }, { id: '2', quantity: 1 }]);
const reloadedCart = await loadPage('carrinho');
assert.equal(reloadedCart.cartCount(), 3);
assert.equal(reloadedCart.subtotal(), 729.7);
cart.createOrder({ name: 'PRIVATE_NAME', city: 'PRIVATE_CITY', state: 'SP', payment: 'Pix' });
assert.deepEqual(JSON.parse(saved.get('eyeszone.cart.v1')), []);
assert.ok(![...saved.values()].join('').includes('PRIVATE_'));
assert.equal(cart.getOrder().name, 'PRIVATE_NAME');

saved.set('eyeszone.compare.v1', JSON.stringify(['1', '1', 'unknown', '2']));
const comparison = await loadPage('produtos');
assert.deepEqual(comparison.comparisonIds(), ['1', '2']);
assert.equal(comparison.toggleComparison('3'), true);
assert.equal(comparison.toggleComparison('4'), false);
assert.equal(comparison.toggleComparison('unknown'), false);
assert.equal(comparison.toggleComparison(1), false);
assert.deepEqual(comparison.comparisonIds(), ['1', '2', '3']);
assert.equal(comparison.toggleComparison('2'), true);
assert.equal(comparison.toggleComparison('4'), true);
assert.deepEqual(comparison.comparisonIds(), ['1', '3', '4']);
const reloadedComparison = await loadPage('comparar');
assert.deepEqual(reloadedComparison.comparisonIds(), ['1', '3', '4']);
const { comparePage } = reloadedComparison;
assert.ok(comparePage().includes('Kit Alarme Protect'));
assert.ok(comparePage().includes('Compatibilidade'));
comparison.clearComparison();
assert.deepEqual(JSON.parse(saved.get('eyeszone.compare.v1')), []);
assert.ok((await loadPage('comparar')).comparePage().includes('Nenhum equipamento selecionado'));

const { readStored, writeStored } = await loadPage('index');
saved.set('corrupt', '{');
assert.deepEqual(readStored('corrupt'), []);
globalThis.localStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('quota'); } };
assert.deepEqual(readStored('anything'), []);
assert.doesNotThrow(() => writeStored('anything', []));
assert.equal(cart.addToCart('5', 1), true);
assert.equal(cart.cartCount(), 1);
globalThis.localStorage = storage;

const { searchSuggestions, bindSearch } = await loadPage('busca');
assert.equal(searchSuggestions('b').length, 0);
assert.equal(searchSuggestions('   ').length, 0);
assert.equal(searchSuggestions('BIOMETRICO').length, 2);
assert.equal(searchSuggestions('biométrico').length, 2);
assert.equal(searchSuggestions('controle').length, 5);
assert.deepEqual(searchSuggestions('camera').map(product => product.id), ['1', '2', '3', '14', '15']);
assert.equal(searchSuggestions('nvd')[0].id, '21');
assert.equal(searchSuggestions('high endurance')[0].id, '23');
assert.equal(searchSuggestions('<script>bad</script>').length, 0);

// Exercita os handlers por eventos; este teste não simula layout ou um navegador.
class Element extends EventTarget {
  hidden = false;
  attributes = {};
  children = [];
  value = '';
  setAttribute(name, value) { this.attributes[name] = value; }
  removeAttribute(name) { delete this.attributes[name]; }
  scrollIntoView() { this.wasScrolled = true; }
  blur() { this.wasBlurred = true; }
  querySelectorAll() { return this.children; }
  set innerHTML(value) {
    this.children = [...value.matchAll(/id="(suggestion-\d+)"/g)].map(match => {
      const element = new Element(); element.id = match[1]; return element;
    });
  }
}
const input = new Element(), form = new Element(), panel = new Element(), list = new Element(), status = new Element();
const area = { contains: target => [input, form, panel, list].includes(target) };
const root = new Element();
form.querySelector = () => input;
root.querySelector = selector => ({ '.search-area': area, '#site-search': form, '#search-panel': panel, '#search-suggestions': list, '#search-status': status })[selector];
globalThis.location = { href: '' };
bindSearch(root);
input.value = 'camera';
input.dispatchEvent(new Event('input'));
assert.equal(panel.hidden, false);
assert.equal(list.children.length, 5);
assert.equal(input.attributes['aria-expanded'], 'true');
function key(key) {
  const event = new Event('keydown', { cancelable: true });
  Object.defineProperty(event, 'key', { value: key });
  input.dispatchEvent(event);
  return event;
}
assert.equal(key('ArrowDown').defaultPrevented, true);
assert.equal(input.attributes['aria-activedescendant'], 'suggestion-1');
assert.equal(list.children[0].attributes['aria-selected'], 'true');
key('ArrowUp');
assert.equal(input.attributes['aria-activedescendant'], 'suggestion-15');
key('Enter');
assert.equal(location.href, 'produto.html?id=15');
assert.equal(panel.hidden, true);
assert.equal(input.wasBlurred, true);
input.dispatchEvent(new Event('focus'));
assert.equal(key('Escape').defaultPrevented, true);
assert.equal(panel.hidden, true);
assert.equal(input.value, 'camera');
input.dispatchEvent(new Event('input'));
key('Tab');
assert.equal(panel.hidden, true);
input.value = 'Produto inexistente';
input.dispatchEvent(new Event('input'));
assert.equal(list.children.length, 0);
assert.ok(status.textContent.includes('Nenhum produto'));
assert.equal(key('Enter').defaultPrevented, false); // Sem seleção, Enter continua para a busca normal.
input.value = '';
input.dispatchEvent(new Event('input'));
assert.equal(panel.hidden, true);
console.log('OK: carrinho recuperado, dados inválidos, privacidade, armazenamento bloqueado, comparação, busca e teclado.');

const { bindGallery } = await loadPage('produto');
const galleryRoot = new Element(), dialog = new Element(), photo = new Element(), photoTitle = new Element(), zoom = new Element(), viewport = new Element();
const classes = new Set();
viewport.classList = { remove: name => classes.delete(name), toggle: name => { if (classes.has(name)) { classes.delete(name); return false; } classes.add(name); return true; } };
dialog.showModal = () => { dialog.open = true; };
dialog.close = () => { dialog.open = false; };
dialog.getBoundingClientRect = () => ({ left: 10, top: 10, right: 100, bottom: 100 });
const galleryElements = { '#image-dialog': dialog, '#expanded-product-image': photo, '#image-dialog-title': photoTitle, '#image-zoom': zoom, '.image-viewer': viewport };
galleryRoot.querySelector = selector => galleryElements[selector];
galleryRoot.closest = selector => selector === '[data-zoom-product]' ? { dataset: { zoomProduct: '5' } } : null;
bindGallery(galleryRoot);
galleryRoot.dispatchEvent(new Event('click'));
assert.equal(dialog.open, true);
assert.equal(photo.src, './assets/product-6.png');
assert.equal(photo.alt, 'Fechadura Digital Handle');
zoom.onclick();
assert.equal(zoom.attributes['aria-pressed'], 'true');
assert.equal(classes.has('is-zoomed'), true);
zoom.onclick();
assert.equal(classes.has('is-zoomed'), false);
const outside = new Event('click');
Object.defineProperties(outside, { clientX: { value: 0 }, clientY: { value: 0 } });
dialog.dispatchEvent(outside);
assert.equal(dialog.open, false);
console.log('OK: galeria, imagem correta, estado de zoom e fechamento externo.');
