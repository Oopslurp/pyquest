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
  pyrunner.js          # Pyodide + harnais de tests Python
  overworld.js         # carte pixel-art (canvas + noeuds)
  level.js             # moteur de niveau (Monaco + exécution + feedback)
  game.js              # orchestrateur (boot, navigation, HUD, déverrouillage)
data/worlds/
  manifest.json        # liste des 6 mondes + placement sur la carte
  monde-0-test.json    # monde de test (2 niveaux factices)
  README.md            # schéma JSON complet (pour créer de nouveaux mondes)
```

## Ajouter un monde

1. Crée `data/worlds/mon-monde.json` (voir `data/worlds/README.md`).
2. Ajoute une entrée dans `manifest.json` avec `file`, `requires`, `node`.

Rien d'autre : le moteur s'occupe du reste.

## Limite connue (v1)

Le code Python s'exécute sur le thread principal. Une boucle infinie
(`while True:`) figera l'onglet — il suffit de recharger la page. Une future
version déplacera Pyodide dans un Web Worker avec délai d'expiration.
