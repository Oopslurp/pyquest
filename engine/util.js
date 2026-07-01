/* ============================================================
   util.js — petites fonctions utilitaires partagées
   ============================================================ */
window.PyQuest = window.PyQuest || {};

PyQuest.util = (function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /** Crée un élément DOM.
   *  el('div', {class:'x', onClick:fn, style:{top:'0'}}, [enfants|texte]) */
  function el(tag, props = {}, children = []) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (v === null || v === undefined) continue;
      if (k === 'class') n.className = v;
      else if (k === 'html') n.innerHTML = v;
      else if (k === 'text') n.textContent = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(n.style, v);
      else if (k.startsWith('on') && typeof v === 'function')
        n.addEventListener(k.slice(2).toLowerCase(), v);
      else n.setAttribute(k, v);
    }
    (Array.isArray(children) ? children : [children]).forEach((c) => {
      if (c === null || c === undefined) return;
      n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return n;
  }

  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (m) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])
    );

  async function fetchJSON(url) {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error('Impossible de charger ' + url + ' (' + r.status + ')');
    return r.json();
  }

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /** Affiche un unique .screen et masque les autres. */
  function showScreen(id) {
    $$('.screen').forEach((s) => s.classList.add('hidden'));
    const t = document.getElementById(id);
    if (t) t.classList.remove('hidden');
  }

  const debounce = (fn, ms = 300) => {
    let t;
    return (...a) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...a), ms);
    };
  };

  /** Garantit qu'une police web est réellement chargée (metrics dispo)
   *  avant qu'un consommateur (ex: Monaco) ne mesure les caractères.
   *  `specs` : variantes CSS à charger, ex: ['14px', '600 14px'].
   *  Résout toujours (une police manquante n'est pas bloquante). */
  const _fontCache = {};
  function ensureFont(family, specs = ['14px']) {
    const key = family + '|' + specs.join(',');
    if (_fontCache[key]) return _fontCache[key];
    _fontCache[key] = (async () => {
      try {
        if (document.fonts && document.fonts.load) {
          await Promise.all(specs.map((s) => document.fonts.load(`${s} "${family}"`)));
          await document.fonts.ready;
        }
      } catch (e) {
        /* police non critique : on continue avec la police de secours */
      }
    })();
    return _fontCache[key];
  }

  return { $, $$, el, esc, fetchJSON, clamp, showScreen, debounce, ensureFont };
})();
