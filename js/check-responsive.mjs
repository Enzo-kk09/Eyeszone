// Testes de comportamento e de restrições de layout. Não substituem um navegador.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadPage } from './test-support.mjs';
const { bindResponsiveUI } = await loadPage('index');

class Element extends EventTarget {
  dataset = {};
  attributes = {};
  focused = false;
  setAttribute(name, value) { this.attributes[name] = value; }
  focus() { this.focused = true; }
}
const menu = new Element();
const nav = new Element();
const filters = new Element();
const media = new EventTarget();
media.matches = true;
let activeFilters = filters;
const root = { querySelector: selector => ({ '#category-menu': menu, '#category-navigation': nav, '.filter-box': activeFilters })[selector] };
const ui = bindResponsiveUI(root, media);
const click = () => menu.dispatchEvent(new Event('click'));
function resize(mobile) { media.matches = mobile; media.dispatchEvent(new Event('change')); }
assert.equal(nav.dataset.open, 'false');
assert.equal(menu.attributes['aria-expanded'], 'false');
assert.equal(filters.open, false);
click();
assert.equal(nav.dataset.open, 'true');
assert.equal(menu.attributes['aria-expanded'], 'true');
click();
assert.equal(nav.dataset.open, 'false');
click();
const escape = new Event('keydown', { cancelable: true });
Object.defineProperty(escape, 'key', { value: 'Escape' });
nav.dispatchEvent(escape);
assert.equal(nav.dataset.open, 'false');
assert.equal(menu.focused, true);
assert.equal(escape.defaultPrevented, true);
resize(false);
assert.equal(nav.dataset.open, 'true');
assert.equal(menu.attributes['aria-expanded'], 'true');
assert.equal(filters.open, true);
click();
assert.equal(nav.dataset.open, 'true');
resize(true);
assert.equal(nav.dataset.open, 'false');
assert.equal(filters.open, false);
click();
ui.refresh(); // Navegar para outra página fecha o menu.
assert.equal(nav.dataset.open, 'false');
activeFilters = null;
resize(false); // Páginas sem filtros também acompanham o breakpoint.
resize(true);
activeFilters = new Element();
ui.refresh();
assert.equal(activeFilters.open, false);
resize(false);
assert.equal(activeFilters.open, true);

// Leitura da cascata para os seletores envolvidos nas regressões reportadas.
// O cálculo abaixo considera as grades, gaps e paddings declarados no CSS;
// não simula fontes, pintura, scrollWidth nem o motor de layout de um browser.
const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/@font-face\s*\{[^}]*\}/g, '');
const rules = [];
function parseRules(source, conditions = []) {
  let offset = 0;
  while (offset < source.length) {
    const start = source.indexOf('{', offset);
    if (start < 0) { assert.equal(source.slice(offset).trim(), ''); break; }
    const selector = source.slice(offset, start).trim();
    let depth = 1;
    let end = start + 1;
    for (; end < source.length && depth; end++) {
      if (source[end] === '{') depth++;
      if (source[end] === '}') depth--;
    }
    assert.equal(depth, 0, `Chaves CSS inválidas: ${selector}`);
    const body = source.slice(start + 1, end - 1);
    if (selector.startsWith('@media')) parseRules(body, [...conditions, selector.slice(6).trim()]);
    else {
      assert.ok(!selector.startsWith('@'), `Regra não suportada pelo teste: ${selector}`);
      const declarations = {};
      for (const declaration of body.split(';').filter(part => part.trim())) {
        const colon = declaration.indexOf(':');
        assert.ok(colon > 0, `Declaração CSS inválida: ${declaration}`);
        declarations[declaration.slice(0, colon).trim()] = declaration.slice(colon + 1).trim();
      }
      rules.push({ selectors: selector.split(',').map(part => part.trim()), declarations, conditions });
    }
    offset = end;
  }
}
parseRules(css);
function styles(selector, width) {
  const selectors = Array.isArray(selector) ? selector : [selector];
  return rules.filter(rule => rule.selectors.some(item => selectors.includes(item)) && rule.conditions.every(condition => {
    const max = condition.match(/^\(max-width:\s*(\d+)px\)$/);
    return max ? width <= Number(max[1]) : false;
  })).reduce((all, rule) => ({ ...all, ...rule.declarations }), {});
}
function terms(value) {
  const values = [];
  let start = 0, depth = 0;
  for (let i = 0; i <= value.length; i++) {
    if (value[i] === '(') depth++;
    if (value[i] === ')') depth--;
    if (i === value.length || (depth === 0 && /\s/.test(value[i]))) {
      if (i > start) values.push(value.slice(start, i));
      start = i + 1;
    }
  }
  return values;
}
const pixels = value => {
  const match = value.match(/^([\d.]+)px$/);
  assert.ok(match, `Medida não suportada: ${value}`);
  return Number(match[1]);
};
function tracks(value) {
  const result = [];
  for (const term of terms(value)) {
    if (term.startsWith('repeat(')) {
      const comma = term.indexOf(',');
      const count = Number(term.slice(7, comma));
      for (let i = 0; i < count; i++) result.push(...tracks(term.slice(comma + 1, -1).trim()));
    } else if (term.startsWith('minmax(')) {
      const match = term.match(/^minmax\((0|[\d.]+px),\s*([\d.]+)fr\)$/);
      assert.ok(match, term);
      result.push({ min: match[1] === '0' ? 0 : pixels(match[1]), fr: Number(match[2]) });
    } else if (/fr$/.test(term)) result.push({ min: 0, fr: Number(term.slice(0, -2)) });
    else result.push({ min: pixels(term), fr: 0 });
  }
  return result;
}
function gridWidths(style, width) {
  const list = tracks(style['grid-template-columns']);
  const gapTerms = terms(style.gap || '0px');
  const gap = pixels(gapTerms.at(-1));
  let remaining = width - gap * (list.length - 1);
  const allocated = list.map(item => item.fr ? null : item.min);
  remaining -= allocated.reduce((sum, value) => sum + (value || 0), 0);
  let unresolved = list.map((item, i) => item.fr ? i : -1).filter(i => i >= 0);
  while (unresolved.length) {
    const weight = unresolved.reduce((sum, i) => sum + list[i].fr, 0);
    const capped = unresolved.filter(i => remaining * list[i].fr / weight < list[i].min);
    if (!capped.length) {
      for (const i of unresolved) allocated[i] = remaining * list[i].fr / weight;
      break;
    }
    for (const i of capped) { allocated[i] = list[i].min; remaining -= list[i].min; }
    unresolved = unresolved.filter(i => !capped.includes(i));
  }
  assert.ok(remaining >= 0, 'Colunas fixas ultrapassam o espaço disponível');
  return allocated;
}
function horizontalPadding(style) {
  if (style['padding-inline']) return 2 * pixels(style['padding-inline']);
  const values = terms(style.padding || '0px');
  return 2 * pixels(values.length > 1 ? values[1] : values[0]);
}
const widths = [320,359,360,375,390,414,480,481,600,601,760,761,768,820,900,901,1024,1040,1041,1120,1280,1440];
for (const width of widths) {
  const gutter = pixels(styles(':root', width)['--gutter']);
  const storeWidth = Math.min(1360, width - gutter * 2);
  const storeStyle = styles('.store', width);
  const mainWidth = width <= 760 ? storeWidth : gridWidths(storeStyle, storeWidth).at(-1);
  const cards = gridWidths(styles('.catalog-grid', width), mainWidth);
  assert.ok(cards.every(x => x >= 144), 'Cartões apertados em ' + width + 'px');
  const transactionWidth = Math.min(1220, width - gutter * 2);
  const purchaseStyle = styles('.purchase-layout', width);
  const purchaseWidth = purchaseStyle.display === 'block' ? transactionWidth : gridWidths(purchaseStyle, transactionWidth)[0];
  if (width <= 1040) assert.equal(purchaseStyle.display, 'block');
  const fieldWidths = gridWidths(styles('.fields', width), purchaseWidth);
  assert.ok(fieldWidths.every(x => x >= 160), 'Campos apertados em ' + width + 'px');
  if (width > 760) {
    const cartWidths = gridWidths(styles('.cart-item', width), purchaseWidth);
    assert.ok(cartWidths[0] - 113 >= 144, 'Nome apertado no carrinho em ' + width + 'px');
    assert.ok(cartWidths[1] >= 116, 'Quantidade sem espaço em ' + width + 'px');
  }
  assert.equal(styles('.search input', width)['font-size'], '1rem');
  assert.equal(styles('.field input', width)['font-size'], '1rem');
  if (width <= 760) {
    assert.equal(styles('.main-nav', width).display, 'none');
    assert.equal(styles('.main-nav[data-open="true"]', width).display, 'block');
    assert.equal(styles('.mobile-departments>button', width)['min-height'], '46px');
    assert.equal(styles('.steps .step-number', width).display, 'none');
  }
  if (width <= 480) assert.equal(styles('.buy-row', width).display, 'block');
}
assert.equal(styles('[hidden]', 390).display, 'none!important');
assert.equal(styles('.comparison-wrap', 390).overflow, 'auto');
assert.equal(styles('.comparison-wrap.single .comparison-table', 390)['min-width'], '0');
assert.ok(!/\b(?:body|html)\s*\{[^}]*overflow(?:-x)?:\s*hidden/.test(css));
console.log('OK: menu, Escape, rotação, filtros e restrições das grades em ' + widths.length + ' larguras (320–1440px). Auditoria de CSS, sem renderização visual.');
