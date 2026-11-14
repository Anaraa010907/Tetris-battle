
(() => {
'use strict';
const w = window, d = document, de = d.documentElement;
if (w.MableI18n) return;
const NAMES = { en: 'English', es: 'Espa\u00f1ol', 'pt-BR': 'Portugu\u00eas (Brasil)', fr: 'Fran\u00e7ais', de: 'Deutsch', ja: '\u65e5\u672c\u8a9e', ar: '\u0627\u0644\u0639\u0631\u0628\u064a\u0629' };
const FONTS = { ar: '"Noto Naskh Arabic","Geeza Pro",system-ui', ja: '"Hiragino Sans","Noto Sans JP",system-ui' };
const RTL = ['ar', 'he', 'fa', 'ur'], script = d.currentScript;
let data = {};
try { data = JSON.parse(d.getElementById('mable-strings').textContent) || {}; } catch (_e) {}
const table = data.strings || {};
const source = typeof data.source === 'string' ? data.source : 'en';
const listed = Array.isArray(data.locales) ? data.locales : Object.keys(table);
const avail = listed.filter(l => table[l]);
if (!avail.includes(source)) avail.unshift(source);
const norm = tag => {
const p = String(tag || '').toLowerCase().split(/[-_]/)[0];
return p === 'pt' ? 'pt-BR' : p;
};
const pick = tag => { const l = norm(tag); return avail.includes(l) ? l : null; };
const fragment = () => { try { return new URLSearchParams(location.hash.slice(1)).get('mable-lang'); } catch (_e) { return null; } };
const device = () => {
for (const tag of navigator.languages?.length ? navigator.languages : [navigator.language]) { const l = pick(tag); if (l) return l; }
return null;
};
let cur = pick(fragment()) || pick(w.__MABLE_HOST_LOCALE__) || device() || pick('en') || source, listeners = [];
const warned = {};
const dir = () => (RTL.includes(cur.split('-')[0]) ? 'rtl' : 'ltr');
const localeName = loc => {
if (NAMES[loc]) return NAMES[loc];
try { return new Intl.DisplayNames([loc], { type: 'language' }).of(loc) || loc; } catch (_e) { return loc; }
};
const lookup = (loc, key) => { const s = table[loc]?.[key]; return typeof s === 'string' && s ? s : null; };
const plural = (loc, n) => { try { return new Intl.PluralRules(loc).select(n); } catch (_e) { return n === 1 ? 'one' : 'other'; } };
const number = (n, options) => { try { return new Intl.NumberFormat(cur === 'ar' ? 'ar-u-nu-latn' : cur, options).format(n); } catch (_e) { return String(n); } };
const t = (key, vars) => {
key = String(key);
const n = typeof vars?.n === 'number' ? vars.n : vars?.count;
let s = null;
for (const loc of [cur, source, 'en']) {
s = lookup(loc, key);
if (s === null && typeof n === 'number') s = lookup(loc, key + '.' + plural(loc, n)) || lookup(loc, key + '.other');
if (s !== null) break;
}
if (s === null) {
if (!warned[key]) { warned[key] = 1; console.warn('mable_i18n_missing_key', key); }
return key;
}
return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] === undefined ? m : typeof vars[k] === 'number' ? number(vars[k]) : String(vars[k]))) : s;
};
const font = e => {
if (e.__mableFont === undefined) e.__mableFont = e.style.fontFamily;
e.style.fontFamily = e.__mableFont;
if (FONTS[cur]) e.style.fontFamily = getComputedStyle(e).fontFamily + ',' + FONTS[cur];
};
const SELECTOR = '[data-i18n],[data-i18n-aria]';
const apply = (root = d) => {
if (!root.querySelectorAll) return;
const list = [...root.querySelectorAll(SELECTOR)];
if (root.matches?.(SELECTOR)) list.unshift(root);
for (const e of list) {
const ds = e.dataset;
let vars = null;
try { vars = ds.i18nVars ? JSON.parse(ds.i18nVars) : null; } catch (_e) {}
if (ds.i18n) { e.textContent = t(ds.i18n, vars); font(e); }
if (ds.i18nAria) e.setAttribute('aria-label', t(ds.i18nAria, vars));
}
};
const canvasText = ctx => {
try {
ctx.direction = dir();
ctx.textAlign = 'start';
if (FONTS[cur] && !ctx.font.includes(FONTS[cur])) ctx.font += ',' + FONTS[cur];
} catch (_e) {}
return ctx;
};
const update = () => {
de.lang = cur;
de.dir = dir();
apply();
paint();
for (const cb of listeners) { try { cb(cur); } catch (error) { setTimeout(() => { throw error; }); } }
};
const setLocale = loc => {
const l = pick(loc);
if (!l) return false;
if (l !== cur) { cur = l; update(); }
return true;
};
const on = (target, type, fn) => EventTarget.prototype.addEventListener.call(target, type, fn);
on(w, 'message', e => { if (e.data?.type === 'mable:host-locale') setLocale(e.data.locale); });
on(w, 'hashchange', () => setLocale(fragment()));
w.MableI18n = {
t, apply, canvasText, fmt: { number },
setLocale, localeName,
onChange: cb => { listeners.push(cb); return () => { listeners = listeners.filter(x => x !== cb); }; },
get locale() { return cur; },
get dir() { return dir(); },
get locales() { return avail.slice(); },
get source() { return source; },
};
const style = d.createElement('style');
style.textContent = '[data-game-root]{direction:ltr}html[dir=rtl] [data-i18n]{direction:rtl;unicode-bidi:isolate}';
(d.head || de).appendChild(style);
de.lang = cur;
de.dir = dir();
const boot = (w.__mableBoot = { state: 'loading', by: null, at: null });
const shell = d.createElement('div');
shell.id = 'mable-boot';
shell.setAttribute('data-mable-loading', '');
shell.style.cssText = 'position:fixed;inset:0;z-index:2147483646;pointer-events:none;transition:opacity .25s';
const ui = shell.attachShadow ? shell.attachShadow({ mode: 'closed' }) : shell;
ui.innerHTML = '<style>' +
'.s{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;padding:0 12%;background:var(--mable-boot-background,radial-gradient(circle at 50% 38%,#30365a,#0c0e18 70%));color:var(--mable-boot-color,#fff);font:600 16px system-ui,"Geeza Pro","Hiragino Sans",sans-serif;font-family:var(--mable-boot-font,system-ui,"Geeza Pro","Hiragino Sans",sans-serif);text-align:center}' +
'.b{width:min(56vw,280px);height:6px;border-radius:3px;background:#fff3;overflow:hidden}' +
'.b i{display:block;height:100%;width:30%;border-radius:3px;background:var(--mable-boot-accent,currentColor);animation:m 1.1s ease-in-out infinite}' +
'.p i{animation:none}' +
'.status{margin:0;max-width:36em;font-size:14px;font-weight:400;line-height:1.5;white-space:pre-line}' +
'@media(prefers-reduced-motion:reduce){.b i{animation:none;transform:none}}' +
'@keyframes m{from{transform:translateX(-110%)}to{transform:translateX(340%)}}' +
'</style><div class="s"><p class="status" role="status" hidden></p><div class="b"><i></i></div></div>';
const q = sel => ui.querySelector(sel);
const screen = q('.s'), bar = q('.b');
if (script?.hasAttribute('data-existing-loading')) {
screen.style.background = 'transparent';
bar.hidden = true;
}
function paint() {
screen.lang = cur;
screen.dir = dir();
}
paint();
de.appendChild(shell);
const finish = by => {
if (boot.state !== 'loading') return;
ready.disconnect();
Object.assign(boot, { state: 'fading', by, at: Math.round(performance.now()) });
shell.style.opacity = '0';
setTimeout(() => { shell.remove(); boot.state = 'done'; }, 260);
};
boot.dismiss = () => finish('review');
const marked = () => { if (d.querySelector('[data-game-ready]:not([data-game-ready=false]):not([data-game-ready="0"])')) finish('attr'); };
const ready = new MutationObserver(marked);
ready.observe(de, { subtree: true, attributes: true, attributeFilter: ['data-game-ready'] });
new MutationObserver(records => {
for (const r of records) for (const node of r.addedNodes) if (node.nodeType === 1) apply(node);
}).observe(de, { subtree: true, childList: true });
on(d, 'DOMContentLoaded', () => { apply(); paint(); marked(); });
if (script?.hasAttribute('data-auto-ready')) {
on(w, 'load', () => requestAnimationFrame(() => requestAnimationFrame(() => finish('load'))));
}
w.MableBoot = {
ready: () => finish('call'),
status: text => {
const status = q('.status');
status.textContent = String(text ?? '').slice(0, 400);
status.hidden = !status.textContent;
},
progress: p => {
const measured = p !== null && p !== undefined && Number.isFinite(Number(p));
bar.className = measured ? 'b p' : 'b';
bar.firstChild.style.cssText = measured ? `width:${Math.max(0, Math.min(1, Number(p))) * 100}%;transform:none` : '';
},
};
})();
