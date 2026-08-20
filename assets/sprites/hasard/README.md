# Sprites — thème « Hasard » (Monde 7, branche maths)

Pixel art vectoriel (SVG, `shape-rendering="crispEdges"`), palette Sweetie-16.
Résolution native 16×16 (bannière : 128×40). Rendu net grâce à
`image-rendering: pixelated` côté CSS.

| Fichier           | Usage |
|-------------------|-------|
| `dice.svg`        | le dé du destin (face 5) |
| `coin.svg`        | pile ou face — l'épreuve de Bernoulli et ses deux issues |
| `jester.svg`      | le bouffon, celui qui parie contre le roi au niveau BOSS |
| `histogram.svg`   | la distribution des sommes de deux dés : le 7 domine |
| `banner.svg`      | bandeau : lanternes, deux dés sur la table, la courbe des sommes |

Branchement :
- `banner.svg` est référencé par `banner` dans `manifest.json` (monde-7) et
  injecté en haut du panneau du monde par `engine/game.js`.
- La carte overworld dessine un mini-dé sur l'île du monde au thème `hasard`
  (voir `engine/overworld.js`).
