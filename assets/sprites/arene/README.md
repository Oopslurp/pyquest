# Sprites — thème « Arène » (Monde 4)

Pixel art vectoriel (SVG, `shape-rendering="crispEdges"`), palette Sweetie-16.
Résolution native 16×16 (bannière : 128×40). Rendu net grâce à
`image-rendering: pixelated` côté CSS.

| Fichier       | Usage |
|---------------|-------|
| `podium.svg`  | podium et coupe (des barres… triées) |
| `bars.svg`    | barres en cours de tri, flèche d'échange |
| `swords.svg`  | épées croisées (le duel linéaire vs dichotomie) |
| `fighter.svg` | combattant de l'arène |
| `banner.svg`  | bandeau : gradins, sable, barres à trier au centre, podium, fanions |

Branchement :
- `banner.svg` est référencé par `banner` dans `manifest.json` (monde-4) et
  injecté en haut du panneau du monde par `engine/game.js`.
- La carte overworld dessine un mini-podium sur l'île du monde au thème
  `arene` (voir `engine/overworld.js`).
