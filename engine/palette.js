/* ============================================================
   palette.js — palette limitée cohérente (Sweetie-16 / GrafxKid)
   Sert au canvas de l'overworld et aux couleurs des mondes.
   ============================================================ */
window.PyQuest = window.PyQuest || {};

PyQuest.Palette = {
  // Ordre fixe : utile pour piocher des couleurs par index.
  colors: [
    '#1a1c2c', '#5d275d', '#b13e53', '#ef7d57',
    '#ffcd75', '#a7f070', '#38b764', '#257179',
    '#29366f', '#3b5dc9', '#41a6f6', '#73eff7',
    '#f4f4f4', '#94b0c2', '#566c86', '#333c57',
  ],
  named: {
    night: '#1a1c2c', purple: '#5d275d', red: '#b13e53', orange: '#ef7d57',
    gold: '#ffcd75', lime: '#a7f070', green: '#38b764', teal: '#257179',
    navy: '#29366f', blue: '#3b5dc9', sky: '#41a6f6', cyan: '#73eff7',
    white: '#f4f4f4', silver: '#94b0c2', slate: '#566c86', deep: '#333c57',
  },

  // --- helpers couleur (interpolation pour le dégradé du ciel) ---
  hex2rgb(h) {
    h = h.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  },
  rgb2hex(r, g, b) {
    const c = (x) => ('0' + Math.round(x).toString(16)).slice(-2);
    return '#' + c(r) + c(g) + c(b);
  },
  lerp(a, b, t) {
    const A = this.hex2rgb(a), B = this.hex2rgb(b);
    return this.rgb2hex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
  },
  // dégradé à 3 arrêts
  grad3(t, c0, c1, c2) {
    return t < 0.5 ? this.lerp(c0, c1, t * 2) : this.lerp(c1, c2, (t - 0.5) * 2);
  },
};
