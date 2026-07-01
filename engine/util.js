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

  return { $, $$, el, esc, fetchJSON, clamp, showScreen, debounce };
})();
