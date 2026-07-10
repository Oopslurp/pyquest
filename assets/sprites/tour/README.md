# Sprites — thème « Tour » (Monde 3)

Pixel art vectoriel (SVG, `shape-rendering="crispEdges"`), palette Sweetie-16.
Résolution native 16×16 (bannière : 128×40). Rendu net grâce à
`image-rendering: pixelated` côté CSS.

| Fichier      | Usage |
|--------------|-------|
| `tower.svg`  | la tour, fenêtres dorées en spirale |
| `spiral.svg` | spirale (motif de la récursion, centre blanc = cas de base) |
| `hanoi.svg`  | Tours de Hanoï (le boss du monde) |
| `mage.svg`   | le Mage de la tour |
| `banner.svg` | bandeau nocturne : trois tours de tailles décroissantes (clin d'œil récursif), Hanoï au premier plan, le mage en chemin |

Branchement :
- `banner.svg` est référencé par `banner` dans `manifest.json` (monde-3) et
  injecté en haut du panneau du monde par `engine/game.js`.
- La carte overworld dessine une mini-tour sur l'île du monde au thème
  `tour` (voir `engine/overworld.js`).
