/* ============================================================
   overworld.js — carte du monde en pixel art
   ------------------------------------------------------------
   - Canvas basse résolution (384x216) mis à l'échelle (pixelated)
     dessinant une scène de coucher de soleil sur un lac.
   - Un SVG relie les mondes par un chemin en pointillés.
   - Des boutons DOM (.wnode) positionnés en % servent de mondes
     cliquables (verrouillé / ouvert / terminé).
   ============================================================ */
window.PyQuest = window.PyQuest || {};

PyQuest.Overworld = (function () {
  const { el } = PyQuest.util;
  const P = PyQuest.Palette;

  /** Dessine le décor. `worlds` = tableau des entrées manifest (avec .node). */
  function drawScene(canvas, worlds) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const horizon = Math.floor(H * 0.5);

    // --- Ciel (dégradé nuit -> mauve -> or, quantifié par bandes de 2px) ---
    for (let y = 0; y < horizon; y += 2) {
      const t = y / horizon;
      ctx.fillStyle = P.grad3(t, P.named.night, P.named.purple, P.named.gold);
      ctx.fillRect(0, y, W, 2);
    }

    // --- Soleil + halo ---
    const sx = Math.floor(W * 0.62), sy = Math.floor(horizon * 0.68);
    const halo = [
      [22, P.named.orange], [16, P.named.gold], [11, '#fff2c8'],
    ];
    halo.forEach(([r, c]) => { ctx.fillStyle = c; disc(ctx, sx, sy, r); });

    // --- Montagnes lointaines (deux couches) ---
    silhouette(ctx, W, horizon, horizon - 6, P.named.deep, 0.0);
    silhouette(ctx, W, horizon, horizon - 2, P.named.slate, 0.5);

    // --- Eau (dégradé + reflet du soleil) ---
    for (let y = horizon; y < H; y += 2) {
      const t = (y - horizon) / (H - horizon);
      ctx.fillStyle = P.lerp(P.named.sky, P.named.night, t);
      ctx.fillRect(0, y, W, 2);
    }
    // colonne de reflet
    for (let y = horizon; y < H; y += 4) {
      const t = (y - horizon) / (H - horizon);
      const w = 6 + t * 10;
      ctx.fillStyle = P.lerp(P.named.gold, P.named.orange, t);
      ctx.globalAlpha = 0.85 - t * 0.5;
      ctx.fillRect(sx - w / 2, y, w, 2);
    }
    ctx.globalAlpha = 1;
    // vaguelettes
    ctx.fillStyle = P.named.cyan;
    for (let i = 0; i < 60; i++) {
      const y = horizon + 4 + Math.floor(rand(i * 7) * (H - horizon - 6));
      const x = Math.floor(rand(i * 13) * W);
      ctx.globalAlpha = 0.25;
      ctx.fillRect(x, y, 3, 1);
    }
    ctx.globalAlpha = 1;

    // --- Îlots sous chaque monde ---
    worlds.forEach((w, i) => {
      const cx = (w.node.x / 100) * W;
      const cy = (w.node.y / 100) * H;
      drawIslet(ctx, cx, cy + 14, i === 0, w);
    });
  }

  function disc(ctx, cx, cy, r) {
    for (let y = -r; y <= r; y++) {
      const dx = Math.floor(Math.sqrt(r * r - y * y));
      ctx.fillRect(cx - dx, cy + y, dx * 2, 1);
    }
  }

  // Silhouette de collines pseudo-aléatoire.
  function silhouette(ctx, W, baseY, topY, color, seed) {
    ctx.fillStyle = color;
    const step = 8;
    for (let x = 0; x < W; x += step) {
      const h = (Math.sin((x + seed * 100) * 0.05) * 0.5 + 0.5) * (baseY - topY);
      const y = baseY - h;
      ctx.fillRect(x, y, step, baseY - y);
    }
  }

  // Petit îlot (mont). `withLighthouse` ajoute un phare (clin d'œil à la réf) ;
  // sinon on dessine le décor associé au thème du monde (`entry.theme`).
  function drawIslet(ctx, cx, cy, withLighthouse, entry) {
    cx = Math.round(cx); cy = Math.round(cy);
    // ombre/reflet
    ctx.fillStyle = P.named.navy;
    ellipseFill(ctx, cx, cy + 4, 20, 4);
    // terre
    ctx.fillStyle = P.named.teal;
    ellipseFill(ctx, cx, cy, 18, 7);
    ctx.fillStyle = P.named.green;
    ellipseFill(ctx, cx, cy - 2, 14, 5);
    if (withLighthouse) {
      // corps
      ctx.fillStyle = P.named.white; ctx.fillRect(cx - 2, cy - 16, 4, 12);
      ctx.fillStyle = P.named.red;   ctx.fillRect(cx - 2, cy - 13, 4, 2);
      ctx.fillStyle = P.named.red;   ctx.fillRect(cx - 2, cy - 8, 4, 2);
      // lanterne
      ctx.fillStyle = P.named.gold;  ctx.fillRect(cx - 1, cy - 19, 2, 3);
    } else if (entry && entry.theme === 'village') {
      drawHouseMini(ctx, cx, cy - 1);
    } else if (entry && entry.theme === 'marche') {
      drawStallMini(ctx, cx, cy - 1);
    } else if (entry && entry.theme === 'tour') {
      drawTowerMini(ctx, cx, cy - 1);
    } else if (entry && entry.theme === 'arene') {
      drawPodiumMini(ctx, cx, cy - 1);
    }
  }

  // Mini-podium de l'arène (décor de carte, cohérent avec assets/sprites/arene).
  function drawPodiumMini(ctx, cx, cy) {
    cx = Math.round(cx); cy = Math.round(cy);
    // socle
    ctx.fillStyle = P.named.deep; ctx.fillRect(cx - 5, cy - 3, 10, 1);
    // marches : 2e, 1re, 3e place (des barres triées !)
    ctx.fillStyle = P.named.silver; ctx.fillRect(cx - 5, cy - 6, 3, 3);
    ctx.fillStyle = P.named.gold;   ctx.fillRect(cx - 2, cy - 8, 4, 5);
    ctx.fillStyle = P.named.orange; ctx.fillRect(cx + 2, cy - 5, 3, 2);
    // coupe au sommet
    ctx.fillStyle = P.named.white;  ctx.fillRect(cx - 1, cy - 10, 2, 2);
  }

  // Mini-tour de la Récursion (décor de carte, cohérent avec assets/sprites/tour).
  function drawTowerMini(ctx, cx, cy) {
    cx = Math.round(cx); cy = Math.round(cy);
    // créneaux
    ctx.fillStyle = P.named.deep;
    ctx.fillRect(cx - 3, cy - 16, 2, 2);
    ctx.fillRect(cx, cy - 16, 1, 2);
    ctx.fillRect(cx + 2, cy - 16, 2, 2);
    // corps + lumière
    ctx.fillStyle = P.named.slate;  ctx.fillRect(cx - 3, cy - 14, 7, 12);
    ctx.fillStyle = P.named.silver; ctx.fillRect(cx - 3, cy - 14, 1, 12);
    // fenêtres dorées en spirale
    ctx.fillStyle = P.named.gold;
    ctx.fillRect(cx - 1, cy - 12, 1, 1);
    ctx.fillRect(cx + 1, cy - 9, 1, 1);
    ctx.fillRect(cx - 1, cy - 6, 1, 1);
    // porte
    ctx.fillStyle = P.named.purple; ctx.fillRect(cx - 1, cy - 4, 2, 2);
  }

  // Mini-étal du marché (décor de carte, cohérent avec assets/sprites/marche).
  function drawStallMini(ctx, cx, cy) {
    cx = Math.round(cx); cy = Math.round(cy);
    // auvent rayé rouge/blanc
    ctx.fillStyle = P.named.red;   ctx.fillRect(cx - 4, cy - 10, 8, 2);
    ctx.fillStyle = P.named.white; ctx.fillRect(cx - 3, cy - 10, 2, 2);
    ctx.fillStyle = P.named.white; ctx.fillRect(cx + 1, cy - 10, 2, 2);
    // poteaux
    ctx.fillStyle = P.named.slate;
    ctx.fillRect(cx - 4, cy - 8, 1, 5);
    ctx.fillRect(cx + 3, cy - 8, 1, 5);
    // comptoir + marchandises
    ctx.fillStyle = P.named.gold;   ctx.fillRect(cx - 4, cy - 5, 8, 2);
    ctx.fillStyle = P.named.lime;   ctx.fillRect(cx - 2, cy - 6, 2, 1);
    ctx.fillStyle = P.named.orange; ctx.fillRect(cx + 1, cy - 6, 2, 1);
  }

  // Mini-maison du village (décor de carte, cohérent avec assets/sprites/village).
  function drawHouseMini(ctx, cx, cy) {
    cx = Math.round(cx); cy = Math.round(cy);
    // toit
    ctx.fillStyle = P.named.orange; ctx.fillRect(cx - 2, cy - 11, 4, 1);
    ctx.fillStyle = P.named.red;    ctx.fillRect(cx - 3, cy - 10, 6, 1);
    ctx.fillStyle = P.named.red;    ctx.fillRect(cx - 4, cy - 9, 8, 1);
    // mur
    ctx.fillStyle = P.named.gold;   ctx.fillRect(cx - 3, cy - 8, 6, 5);
    // porte
    ctx.fillStyle = P.named.purple; ctx.fillRect(cx - 1, cy - 6, 2, 3);
    // fenêtres
    ctx.fillStyle = P.named.cyan;   ctx.fillRect(cx - 3, cy - 7, 1, 1); ctx.fillRect(cx + 2, cy - 7, 1, 1);
  }

  function ellipseFill(ctx, cx, cy, rx, ry) {
    for (let y = -ry; y <= ry; y++) {
      const dx = Math.floor(rx * Math.sqrt(1 - (y * y) / (ry * ry)));
      ctx.fillRect(Math.round(cx - dx), Math.round(cy + y), dx * 2, 1);
    }
  }

  // Générateur pseudo-aléatoire déterministe (pour un rendu stable).
  function rand(n) {
    const x = Math.sin(n * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  }

  /** Construit la carte complète.
   *  states : [{ entry, unlocked, complete, done, total }] alignés sur manifest. */
  function render(dom, states, onSelect) {
    const { canvas, svg, nodes } = dom;
    nodes.innerHTML = '';
    svg.innerHTML = '';

    drawScene(canvas, states.map((s) => s.entry));

    // Chemin en pointillés reliant les mondes dans l'ordre.
    const SVGNS = 'http://www.w3.org/2000/svg';
    const pts = states.map((s) => `${s.entry.node.x},${s.entry.node.y}`).join(' ');
    const poly = document.createElementNS(SVGNS, 'polyline');
    poly.setAttribute('points', pts);
    poly.setAttribute('fill', 'none');
    poly.setAttribute('stroke', PyQuest.Palette.named.gold);
    poly.setAttribute('stroke-width', '1.2');
    poly.setAttribute('stroke-dasharray', '2 2.5');
    poly.setAttribute('stroke-linecap', 'round');
    poly.setAttribute('opacity', '0.7');
    svg.appendChild(poly);

    // Nœuds mondes.
    states.forEach((s, i) => {
      const cls = s.complete ? 'is-complete' : s.unlocked ? 'is-open' : 'is-locked';
      const icon = s.complete ? '★' : s.unlocked ? String(i) : '🔒';
      const badge = el('div', { class: 'wnode-badge' }, icon);
      // La couleur inline ne s'applique qu'aux mondes ouverts : les états
      // verrouillé (slate) et terminé (or) sont gérés par le CSS.
      if (s.unlocked && !s.complete && s.entry.color) badge.style.background = s.entry.color;

      const node = el(
        'button',
        {
          class: 'wnode ' + cls,
          style: { left: s.entry.node.x + '%', top: s.entry.node.y + '%' },
          title: s.entry.title,
          onClick: () => onSelect(s),
          onMouseenter: () => PyQuest.Audio.hover(),
        },
        [
          badge,
          el('div', { class: 'wnode-label' }, s.entry.title),
          el('div', { class: 'wnode-prog' }, s.total ? `${s.done}/${s.total}` : ''),
        ]
      );
      nodes.appendChild(node);
    });
  }

  return { render };
})();
