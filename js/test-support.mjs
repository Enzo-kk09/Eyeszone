// Executa o JS real de uma página sem DOM, com o mesmo catálogo do site.
import fs from 'node:fs/promises';
const catalog = JSON.parse(await fs.readFile(new URL('../assets/catalogo.json', import.meta.url), 'utf8'));
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const names = ['products','categories','findProduct','findCategory','homePage','categoriesPage','filteredProducts','catalogPage','productPage','cartPage','checkoutPage','confirmationPage','orderPage','orderProgress','comparePage','getCart','cartCount','subtotal','orderTotal','validCart','addToCart','updateQuantity','removeFromCart','createOrder','getOrder','comparisonIds','validComparison','toggleComparison','clearComparison','readStored','writeStored','readSession','writeSession','validOrder','searchSuggestions','bindSearch','bindGallery','bindResponsiveUI'];
export async function loadPage(name) {
  const source = await fs.readFile(new URL(`./${name}.js`, import.meta.url), 'utf8');
  const run = new AsyncFunction('fetch', 'names', source + '\nreturn Object.fromEntries(names.filter(name => eval("typeof " + name) !== "undefined").map(name => [name, eval(name)]));');
  return run(async () => ({ ok: true, json: async () => structuredClone(catalog) }), names);
}
