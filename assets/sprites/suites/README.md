# Sprites — thème « Suites » (Monde 6, branche maths)

Pixel art vectoriel (SVG, `shape-rendering="crispEdges"`), palette Sweetie-16.
Résolution native 16×16 (bannière : 128×40). Rendu net grâce à
`image-rendering: pixelated` côté CSS.

| Fichier            | Usage |
|--------------------|-------|
| `stairs.svg`       | l'escalier des rangs, dont la dernière marche franchit le seuil |
| `threshold.svg`    | le franchissement : une flèche traverse la ligne dorée du seuil |
| `hourglass.svg`    | le sablier — n qui s'écoule, terme après terme |
| `astronomer.svg`   | l'astronome, celui qui relève les termes nuit après nuit |
| `banner.svg`       | bandeau : nuit étoilée, colonnes croissantes, ligne de seuil, astronome |

Branchement :
- `banner.svg` est référencé par `banner` dans `manifest.json` (monde-6) et
  injecté en haut du panneau du monde par `engine/game.js`.
- La carte overworld dessine un mini-escalier sur l'île du monde au thème
  `suites` (voir `engine/overworld.js`).
