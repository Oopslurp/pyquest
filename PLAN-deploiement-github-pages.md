# PLAN — Déploiement sur GitHub Pages

**Rang : 5/5 (mais le plus rapide : ~30 min).** Aujourd'hui, le fils ne peut
jouer que sur le PC du père, serveur local lancé à la main (`py -m
http.server 8000`, qui de plus s'arrête à chaque fermeture de session — déjà
constaté 3 fois). L'app est 100 % statique (HTML/CSS/JS + JSON, Pyodide et
Monaco via CDN) : GitHub Pages l'héberge gratuitement, accessible depuis
n'importe quel navigateur (lycée, portable, etc.). Bonus : sauvegarde
distante du dépôt (il n'existe qu'en local sur ce disque E:).

## Objectif

- Dépôt GitHub `pyquest` (public), branche `main` poussée.
- GitHub Pages activé sur `main` / racine.
- URL du type `https://<user>.github.io/pyquest/` jouable de bout en bout.

## Pré-requis à vérifier AVANT de commencer

1. `gh auth status` → si non connecté : `gh auth login` (l'utilisateur devra
   suivre l'authentification dans le navigateur ; demander avant).
2. **Pages exige un dépôt PUBLIC sur un compte gratuit.** Confirmer avec
   l'utilisateur que rendre le code public lui convient (c'est une app
   éducative personnelle, a priori oui — mais demander explicitement).
3. Vérifier que l'arbre de travail est propre (`git status`) et que tout ce
   qui doit être joué est commité.

## Fichiers à toucher

1. **Créer** `.nojekyll` (fichier vide, à la racine)
2. **Modifier** `README.md` (ajouter l'URL publique + note de déploiement)

C'est tout : AUCUN chemin à changer dans le code (vérification ci-dessous).

## Pourquoi aucun chemin ne casse (vérifié en explorant)

Pages sert le site sous un SOUS-CHEMIN (`/pyquest/`), pas à la racine du
domaine. Tout casse si un chemin commence par `/`. État des lieux :

- `index.html` : tous les liens sont relatifs (`assets/css/style.css`,
  `engine/*.js`) ✔
- `engine/game.js` : `fetchJSON('data/worlds/manifest.json')` et
  `'data/worlds/' + w.file` — relatifs ✔
- `manifest.json` : `"banner": "assets/sprites/..."` — relatif, injecté tel
  quel dans `<img src>` ✔
- CDN (Pyodide, Monaco, Google Fonts) : URLs absolues externes ✔
- `engine/pyrunner.js` (si PLAN-pyodide-worker déjà appliqué) :
  `new Worker('engine/pyworker.js')` — relatif au document ✔ ; le worker
  fait `importScripts` du CDN (autorisé, worker classique) et n'utilise PAS
  SharedArrayBuffer (Pages n'envoie pas COOP/COEP — c'est justement pour ça
  que le plan worker impose terminate+respawn) ✔

## Étapes d'implémentation

### Étape 1 — `.nojekyll`

Créer un fichier vide `.nojekyll` à la racine. (Pages passe sinon le site
dans Jekyll ; rien ne casserait aujourd'hui, mais c'est le garde-fou standard
et ça évite une surprise si un futur dossier commence par `_`.)

### Étape 2 — Créer le dépôt et pousser

```
git add .nojekyll
git commit -m "Déploiement GitHub Pages (.nojekyll)"
gh repo create pyquest --public --source . --remote origin --push
```

Si `gh repo create` échoue parce que le nom existe déjà, choisir
`pyquest-app`. Ne PAS utiliser `--private` (Pages indisponible en gratuit).

### Étape 3 — Activer Pages sur main / racine

```
gh api repos/{owner}/pyquest/pages -X POST -f "source[branch]=main" -f "source[path]=/"
```

Si l'API renvoie 409 (déjà activé) c'est OK. Récupérer l'URL :

```
gh api repos/{owner}/pyquest/pages --jq .html_url
```

### Étape 4 — Vérifier le déploiement

Le premier build prend 1-3 min. Vérifier :

```
curl -s -o /dev/null -w "%{http_code}" https://<user>.github.io/pyquest/
curl -s -o /dev/null -w "%{http_code}" https://<user>.github.io/pyquest/data/worlds/manifest.json
curl -s -o /dev/null -w "%{http_code}" https://<user>.github.io/pyquest/assets/sprites/village/banner.svg
```

Les trois doivent renvoyer 200.

### Étape 5 — `README.md`

Sous le titre, ajouter :

```markdown
**▶ Jouer en ligne : https://<user>.github.io/pyquest/**
```

Et dans la section « Lancer l'application », préciser que le serveur local
n'est nécessaire que pour le développement ; chaque `git push` sur `main`
redéploie automatiquement (délai ~1-3 min).

Commiter et pousser ces changements README.

## Pièges et cas limites découverts en explorant

- **La progression reste par navigateur** (localStorage) : jouer au lycée et
  à la maison = deux sauvegardes indépendantes. À mentionner à l'utilisateur
  dans le compte-rendu (une future synchro est un autre chantier).
- **Cache Pages ~10 min** : après un push, un contenu JSON modifié peut
  mettre quelques minutes à se rafraîchir — faire Ctrl+Shift+R avant de
  conclure à un bug.
- **Ne pas committer de secrets** : le dépôt ne contient que du contenu
  statique, mais vérifier `git status` avant le push initial (pas de fichiers
  parasites — les PLAN-*.md peuvent être poussés sans problème).
- **Nom d'utilisateur GitHub inconnu à l'avance** : utiliser `{owner}` via
  `gh api` (résolu automatiquement) plutôt que de le coder en dur.
- **Si l'utilisateur veut un domaine ou un dépôt privé** : hors périmètre de
  ce plan (nécessite GitHub Pro ou un autre hébergeur type Netlify) — le dire
  plutôt qu'improviser.

## Critères d'acceptation

1. `git remote -v` montre `origin` → github.com/<user>/pyquest.
2. Les 3 `curl` de l'étape 4 renvoient 200.
3. Depuis un navigateur (idéalement un autre appareil ou une fenêtre privée) :
   l'URL publique charge, le boot Pyodide+Monaco aboutit, le niveau 0-1 se
   valide avec succès (XP + confettis), la bannière du Monde 1 s'affiche.
4. La progression persiste après rechargement (localStorage sur le domaine
   github.io).
5. Un `git push` d'un changement trivial (ex : texte du README) est visible
   en ligne au bout de quelques minutes sans intervention manuelle.
