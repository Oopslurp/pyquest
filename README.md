# PyQuest 🎮🐍

RPG pixel-art d'apprentissage de Python. HTML/CSS/JS **vanilla** (aucun
framework). Le moteur est générique : tout le contenu est piloté par des
fichiers JSON dans `data/worlds/`.

## Lancer l'application

Le jeu charge des fichiers JSON via `fetch()` : il faut donc un petit serveur
local (l'ouverture directe du fichier `index.html` en `file://` sera bloquée
par le navigateur).

Depuis le dossier du projet :

```bash
python -m http.server 8000
```

Puis ouvre **http://localhost:8000** dans le navigateur.

> Première ouverture : le chargement de Pyodide (~10 Mo) et de l'éditeur
> Monaco peut prendre quelques secondes. Une connexion internet est requise
> (Pyodide, Monaco et la police sont servis via CDN).

## Structure

```
index.html
assets/
  css/style.css        # thème rétro (police "Press Start 2P", palette Sweetie-16)
  sprites/             # (réservé aux futurs sprites)
  sounds/              # (réservé aux futurs sons ; l'audio actuel est synthétisé)
engine/                # logique GÉNÉRIQUE, réutilisable
  util.js              # helpers DOM
  palette.js           # palette + interpolation couleur
  audio.js             # bips rétro (WebAudio, sans asset)
  storage.js           # sauvegarde localStorage
  pyrunner.js          # client du worker Python (timeout + relance)
  pyworker.js          # Web Worker : Pyodide + harnais de tests Python
  overworld.js         # carte pixel-art (canvas + noeuds)
  level.js             # moteur de niveau (Monaco + exécution + feedback)
  game.js              # orchestrateur (boot, navigation, HUD, déverrouillage)
data/worlds/
  manifest.json        # liste des mondes, prérequis et placement sur la carte
  monde-*.json         # le contenu : 8 mondes, 68 niveaux
  README.md            # schéma JSON complet (pour créer de nouveaux mondes)
tools/
  validate_worlds.py   # les bonnes solutions passent, les codes de départ non
  check_cheats.py      # les mauvaises solutions doivent ÉCHOUER
```

## Les deux chemins de la carte

Après le **Village des Fondamentaux**, la carte se sépare en deux branches, et
les deux sont jouables en parallèle :

- **Chemin des Suites** → **Taverne du Hasard** : le programme d'algorithmique
  de la **spécialité mathématiques** de terminale — termes d'une suite,
  recherche de seuil, somme, dichotomie, méthode d'Euler, puis simulation,
  loi binomiale et loi des grands nombres.
- **Marché des Structures** → **Tour de la Récursion** → **Arène des
  Algorithmes** → **Château des Données** : la culture informatique générale —
  structures de données, récursivité, tris et recherches, traitement de données.

Le tracé de la carte se déduit automatiquement du champ `requires` de chaque
monde : pour ajouter une branche, il suffit de faire pointer deux mondes vers le
même prérequis.

## Ajouter un monde

1. Crée `data/worlds/mon-monde.json` (voir `data/worlds/README.md`).
2. Ajoute une entrée dans `manifest.json` avec `file`, `requires`, `node`.

Rien d'autre : le moteur s'occupe du reste.

## Exécution du code Python

Le code de l'élève s'exécute dans un **Web Worker** (`engine/pyworker.js`),
hors du thread principal. Chaque exécution a un **délai de 6 s** : une boucle
infinie (`while True:`) ne gèle donc jamais l'onglet — le worker est arrêté,
un message l'explique, et un nouveau moteur est relancé automatiquement.
