# PyQuest 🎮🐍

RPG pixel-art d'apprentissage de Python. HTML/CSS/JS **vanilla** (aucun
framework). Le moteur est générique : tout le contenu est piloté par des
fichiers JSON dans `data/worlds/`.

**▶ [Jouer en ligne](https://oopslurp.github.io/pyquest/)**

## Fonctionnalités

- 8 mondes et 68 niveaux progressifs, des fondamentaux aux algorithmes ;
- deux parcours après le premier monde, dont une branche dédiée au programme
  d'algorithmique de terminale spécialité mathématiques ;
- exécution de Python directement dans le navigateur avec Pyodide ;
- éditeur Monaco, tests automatiques, indices et retours d'erreur en français ;
- progression, code et préférences sauvegardés localement dans le navigateur ;
- interface responsive, sans compte et sans serveur applicatif.

## Lancer l'application

La version publique est disponible sur
**https://oopslurp.github.io/pyquest/**. Le serveur local ci-dessous n'est
nécessaire que pour développer ou tester une modification.

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

## Vérifier le contenu

Les outils de validation nécessitent Python 3 :

```bash
python tools/validate_worlds.py
python tools/check_cheats.py
```

Le premier vérifie que les solutions attendues réussissent et que les codes de
départ ne valident pas les exercices. Le second vérifie que des solutions
incorrectes courantes ne passent pas les tests.

## Déploiement

Le site est publié avec GitHub Pages depuis la branche `main`. Chaque mise à
jour poussée sur cette branche est redéployée automatiquement. Tous les chemins
d'assets sont relatifs afin que l'application fonctionne sous `/pyquest/`.

La progression reste propre à chaque navigateur : elle n'est ni envoyée sur
GitHub ni synchronisée entre plusieurs appareils.

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

## Licence

Ce projet est distribué sous licence [MIT](LICENSE), au nom de Mathieu C.

## Crédits

Conçu et développé par Mathieu C., avec l'aide de
[Claude](https://www.anthropic.com/claude) d'Anthropic.
