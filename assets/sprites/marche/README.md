# Sprites — thème « Marché » (Monde 2)

Pixel art vectoriel (SVG, `shape-rendering="crispEdges"`), palette Sweetie-16.
Résolution native 16×16 (bannière : 128×40). Rendu net grâce à
`image-rendering: pixelated` côté CSS.

| Fichier        | Usage |
|----------------|-------|
| `stall.svg`    | étal à auvent rayé rouge/blanc |
| `crate.svg`    | cageot de fruits |
| `scale.svg`    | balance du marchand |
| `merchant.svg` | marchand (tablier, chapeau de paille) |
| `banner.svg`   | bandeau décoratif affiché en tête du monde (panneau de sélection) |

Branchement :
- `banner.svg` est référencé par `banner` dans `manifest.json` (monde-2) et
  injecté en haut du panneau du monde par `engine/game.js`.
- La carte overworld dessine un petit étal rayé sur l'île du monde au thème
  `marche` (voir `engine/overworld.js`).
