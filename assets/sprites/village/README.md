# Sprites — thème « Village » (Monde 1)

Pixel art vectoriel (SVG, `shape-rendering="crispEdges"`), palette Sweetie-16.
Résolution native 16×16 (bannière : 128×40). Rendu net grâce à
`image-rendering: pixelated` côté CSS.

| Fichier         | Usage |
|-----------------|-------|
| `house.svg`     | maison du village |
| `tree.svg`      | arbre |
| `well.svg`      | puits |
| `villager.svg`  | personnage |
| `banner.svg`    | bandeau décoratif affiché en tête du monde (panneau de sélection) |

Branchement :
- `banner.svg` est référencé par `banner` dans `manifest.json` (monde-1) et
  injecté en haut du panneau du monde par `engine/game.js`.
- La carte overworld dessine une petite maison sur l'île du monde au thème
  `village` (voir `engine/overworld.js`).

Ces sprites sont réutilisables pour de futurs décors (carte détaillée, scènes
de dialogue, etc.).
