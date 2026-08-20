# Sprites — thème « Château » (Monde 5)

Pixel art vectoriel (SVG, `shape-rendering="crispEdges"`), palette Sweetie-16.
Résolution native 16×16 (bannière : 128×40). Rendu net grâce à
`image-rendering: pixelated` côté CSS.

| Fichier       | Usage |
|---------------|-------|
| `castle.svg`  | le château : donjon, deux tours, porte des archives |
| `scroll.svg`  | le registre déroulé (colonne des clés, lignes de valeurs) |
| `scribe.svg`  | le scribe archiviste (fiche en main, plume) |
| `chart.svg`   | histogramme des récoltes + ligne pointillée de la moyenne |
| `banner.svg`  | bandeau : aube, rayonnage d'archives, château, histogramme du royaume |

Branchement :
- `banner.svg` est référencé par `banner` dans `manifest.json` (monde-5) et
  injecté en haut du panneau du monde par `engine/game.js`.
- La carte overworld dessine un mini-château sur l'île du monde au thème
  `chateau` (voir `engine/overworld.js`).
