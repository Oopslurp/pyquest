# PLAN — Validateur permanent des mondes (`tools/validate_worlds.py`)

**Rang : 3/5.** Il reste 3 mondes à écrire (~27 niveaux). Jusqu'ici, chaque
monde a été validé avec un script jetable réécrit à la main (deux fois déjà).
Un validateur permanent transforme cette étape en une commande unique — et
attrape automatiquement le piège le plus sournois du format : **les tuples et
sets n'existent pas en JSON**, donc un test `variable`/`function` dont
`expected` devrait être un tuple/set échouera TOUJOURS (`(2,1) == [2,1]` est
faux en Python). Ce piège a déjà nécessité une conception spécifique au
Monde 2 (tests `expression`).

## Objectif

Une commande : `py tools/validate_worlds.py`
- valide le **schéma** du manifest et de chaque monde ;
- exécute la **solution de référence** de chaque niveau (nouveau champ
  `"solution"` dans le JSON) contre ses tests → tout doit passer ;
- exécute le **code de départ** contre les tests → il doit ÉCHOUER (sinon
  niveau « gratuit ») ;
- sort en code 0 (tout vert) ou 1 (au moins un problème), avec un rapport
  lisible.

## Fichiers à toucher

1. **Créer** `tools/validate_worlds.py`
2. **Modifier** `data/worlds/monde-0-test.json` (ajouter `"solution"` aux 2 niveaux)
3. **Modifier** `data/worlds/monde-1-fondamentaux.json` (9 solutions)
4. **Modifier** `data/worlds/monde-2-structures-donnees.json` (9 solutions)
5. **Modifier** `data/worlds/README.md` (documenter `solution` et le workflow)

Le moteur JS ignore les champs inconnus : ajouter `"solution"` ne change rien
à l'exécution. (Le dernier indice de chaque niveau donne déjà la solution,
donc aucune « fuite » nouvelle vers l'élève.)

## Étapes d'implémentation

### Étape 1 — Créer `tools/validate_worlds.py`

Le cœur du script REPRODUIT la sémantique du harnais de `engine/pyrunner.js`
(fonctions `_norm`, `_cmp_stdout`, `_eq`, exécution dans un namespace neuf,
redirection stdin/stdout). Toute divergence rend la validation mensongère.

```python
# Validateur des mondes PyQuest.
# Usage : py tools/validate_worlds.py   (depuis la racine du projet)
# Sortie : rapport + code retour 0 (OK) / 1 (echecs).
import sys, io, json, os, glob, traceback

# Console Windows : forcer UTF-8 pour les accents.
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORLDS_DIR = os.path.join(ROOT, 'data', 'worlds')
TEST_TYPES = {'stdout', 'variable', 'function', 'expression'}
errors = []

def err(msg):
    errors.append(msg)
    print('  [ERREUR]', msg)

# ---------- réplique exacte du harnais de pyrunner.js ----------
def _norm(s):
    return str(s).replace('\r\n', '\n').replace('\r', '\n')

def _cmp_stdout(got, expected, match):
    g, e = _norm(got), _norm(expected)
    if match == 'exact':
        return g == e
    if match == 'contains':
        return e.strip() in g
    if match == 'regex':
        import re
        return re.search(expected, g) is not None
    def clean(t):
        lines = [ln.rstrip() for ln in t.split('\n')]
        while lines and lines[-1] == '':
            lines.pop()
        return '\n'.join(lines)
    return clean(g) == clean(e)

def _eq(got, expected, tol):
    if tol is not None:
        try:
            return abs(got - expected) <= tol
        except TypeError:
            pass
    return got == expected

def run_test(source, test):
    ttype = test.get('type', 'stdout')
    ns = {'__name__': '__main__'}
    old_in, old_out = sys.stdin, sys.stdout
    sys.stdin = io.StringIO(test.get('stdin', '') or '')
    buf = io.StringIO()
    sys.stdout = buf
    ok, error = False, None
    try:
        exec(compile(source, '<student>', 'exec'), ns)
        if ttype == 'stdout':
            ok = _cmp_stdout(buf.getvalue(), test.get('expected', ''), test.get('match', 'smart'))
        elif ttype == 'variable':
            ok = (test['name'] in ns) and _eq(ns[test['name']], test.get('expected'), test.get('tol'))
        elif ttype == 'function':
            fn = ns.get(test['name'])
            ok = callable(fn) and _eq(fn(*test.get('args', [])), test.get('expected'), test.get('tol'))
        elif ttype == 'expression':
            ok = _eq(eval(test['expression'], ns), test.get('expected', True), test.get('tol'))
    except Exception:
        error = traceback.format_exc().strip().splitlines()[-1]
    finally:
        sys.stdin, sys.stdout = old_in, old_out
    return ok, error

# ---------- validation de schéma ----------
def check_level_schema(wid, lv, seen_ids):
    lid = lv.get('id')
    where = f"{wid}/{lid or '??'}"
    if not lid or lid in seen_ids:
        err(f"{where} : id manquant ou duplique")
    seen_ids.add(lid)
    if not lv.get('title'): err(f"{where} : title manquant")
    if not lv.get('statement'): err(f"{where} : statement manquant")
    if not isinstance(lv.get('xp'), int) or lv['xp'] <= 0:
        err(f"{where} : xp doit etre un entier > 0")
    hints = lv.get('hints')
    if not isinstance(hints, list) or len(hints) < 1:
        err(f"{where} : au moins 1 indice requis")
    tests = lv.get('tests')
    if not isinstance(tests, list) or not tests:
        err(f"{where} : au moins 1 test requis")
        return
    for i, t in enumerate(tests):
        tw = f"{where} test#{i+1}"
        tt = t.get('type', 'stdout')
        if tt not in TEST_TYPES:
            err(f"{tw} : type inconnu '{tt}'"); continue
        if tt in ('variable', 'function') and not t.get('name'):
            err(f"{tw} : champ 'name' requis pour type {tt}")
        if tt == 'expression' and not t.get('expression'):
            err(f"{tw} : champ 'expression' requis")
        # Piege JSON : tuple/set impossibles a representer.
        if tt in ('variable', 'function') and isinstance(t.get('expected'), list):
            print(f"  [note] {tw} : expected est une liste JSON — si la valeur Python "
                  f"attendue est un tuple ou un set, ce test echouera toujours ; "
                  f"utiliser un test 'expression'.")

def main():
    manifest = json.load(open(os.path.join(WORLDS_DIR, 'manifest.json'), encoding='utf-8'))
    ids = [w['id'] for w in manifest['worlds']]
    if len(ids) != len(set(ids)):
        err('manifest : ids de mondes dupliques')
    for w in manifest['worlds']:
        req = w.get('requires')
        if req is not None and req not in ids:
            err(f"manifest {w['id']} : requires '{req}' inconnu")
        node = w.get('node') or {}
        if not (0 <= node.get('x', -1) <= 100 and 0 <= node.get('y', -1) <= 100):
            err(f"manifest {w['id']} : node.x/y doivent etre en 0..100")
        if w.get('banner') and not os.path.exists(os.path.join(ROOT, w['banner'])):
            err(f"manifest {w['id']} : banner introuvable ({w['banner']})")
        if not w.get('file'):
            continue
        path = os.path.join(WORLDS_DIR, w['file'])
        if not os.path.exists(path):
            err(f"manifest {w['id']} : fichier introuvable ({w['file']})"); continue

        world = json.load(open(path, encoding='utf-8'))
        print(f"\n=== {w['id']} — {world.get('title', '?')} ({len(world.get('levels', []))} niveaux)")
        if world.get('id') != w['id']:
            err(f"{w['file']} : id interne '{world.get('id')}' != manifest '{w['id']}'")
        seen = set()
        for lv in world.get('levels', []):
            check_level_schema(w['id'], lv, seen)
            lid = f"{w['id']}/{lv.get('id')}"
            sol = lv.get('solution')
            if not sol:
                err(f"{lid} : champ 'solution' manquant (requis pour la validation)")
                continue
            # 1) la solution passe tous les tests
            for i, t in enumerate(lv.get('tests', [])):
                ok, e = run_test(sol, t)
                if not ok:
                    err(f"{lid} test#{i+1} : la solution echoue"
                        + (f" ({e})" if e else ''))
            # 2) le code de depart ne passe PAS tous les tests
            start = lv.get('startCode', '')
            if lv.get('tests') and all(run_test(start, t)[0] for t in lv['tests']):
                err(f"{lid} : le code de depart passe deja les tests (niveau gratuit)")
            if not errors or all(not m.startswith(lid) for m in errors[-4:]):
                print(f"  OK {lid}")

    print('\n' + ('TOUT PASSE ✔' if not errors else f'{len(errors)} PROBLEME(S) ✘'))
    sys.exit(0 if not errors else 1)

if __name__ == '__main__':
    main()
```

### Étape 2 — Ajouter `"solution"` à chaque niveau existant

Placer le champ juste après `"xp"`. Valeurs exactes (JSON, prêtes à coller) :

`monde-0-test.json` :
- 0-1 : `"solution": "print(\"Bonjour, aventurier !\")\n"`
- 0-2 : `"solution": "def addition(a, b):\n    return a + b\n"`

`monde-1-fondamentaux.json` :
- 1-1 : `"solution": "pseudo = \"Alex\"\nniveau = 1\nenergie = 100.0\nactif = True\n"`
- 1-2 : `"solution": "a = 17\nb = 5\nsomme = a + b\nproduit = a * b\nreste = a % b\n"`
- 1-3 : `"solution": "x = 8\ny = 12\negal = x == y\nplus_grand = x > y\ndifferent = x != y\n"`
- 1-4 : `"solution": "pluie = True\nvent = False\nsortir = not pluie and not vent\nalerte = pluie or vent\nbeau_temps = not alerte\n"`
- 1-5 : `"solution": "def mention(note):\n    if note < 10:\n        return \"Recalé\"\n    elif note < 14:\n        return \"Passable\"\n    else:\n        return \"Bien\"\n"`
- 1-6 : `"solution": "def somme_jusqua(n):\n    total = 0\n    for i in range(1, n + 1):\n        total = total + i\n    return total\n"`
- 1-7 : `"solution": "def nb_chiffres(n):\n    compte = 0\n    while n > 0:\n        n = n // 10\n        compte = compte + 1\n    return compte\n"`
- 1-8 : `"solution": "n = int(input())\nprint(\"Le double est\", n * 2)\n"`
- 1-9 : `"solution": "n = int(input())\nfor i in range(1, n + 1):\n    if i % 2 == 0:\n        print(f\"{i}: pair\")\n    else:\n        print(f\"{i}: impair\")\n"`

`monde-2-structures-donnees.json` :
- 2-1 : `"solution": "fruits = [\"pomme\", \"poire\", \"cerise\", \"fraise\"]\npanier = [\"pain\", \"lait\", \"miel\"]\npremier = fruits[0]\ndernier = fruits[-1]\n"`
- 2-2 : `"solution": "stock = [\"pomme\", \"poire\", \"banane\"]\nstock.append(\"kiwi\")\nstock.remove(\"banane\")\nstock.sort()\n"`
- 2-3 : `"solution": "file_attente = [\"Ana\", \"Bob\", \"Chloé\", \"Dan\", \"Eva\", \"Fred\"]\ntrois_premiers = file_attente[:3]\ndeux_derniers = file_attente[-2:]\nun_sur_deux = file_attente[::2]\n"`
- 2-4 : `"solution": "stand = (\"Fruits\", 12)\nnom, allee = stand\n\ndef echange(a, b):\n    return (b, a)\n"`
- 2-5 : `"solution": "prix = {\"pomme\": 2, \"poire\": 3, \"cerise\": 8}\n\ndef prix_de(article):\n    return prix[article]\n"`
- 2-6 : `"solution": "def total_caisse(ventes):\n    return sum(ventes.values())\n\ndef articles_chers(prix, seuil):\n    resultat = []\n    for article, p in prix.items():\n        if p >= seuil:\n            resultat.append(article)\n    return sorted(resultat)\n"`
- 2-7 : `"solution": "clients_lundi = {\"Ana\", \"Bob\", \"Chloé\"}\nclients_mardi = {\"Bob\", \"Dan\"}\nfideles = clients_lundi & clients_mardi\ntous = clients_lundi | clients_mardi\nuniquement_lundi = clients_lundi - clients_mardi\n"`
- 2-8 : `"solution": "def doubles(nombres):\n    return [x * 2 for x in nombres]\n\ndef pairs(nombres):\n    return [x for x in nombres if x % 2 == 0]\n"`
- 2-9 : `"solution": "def bilan(etals):\n    return sum(e[\"vendu\"] for e in etals)\n\ndef stars(etals, seuil):\n    return sorted([e[\"nom\"] for e in etals if e[\"vendu\"] >= seuil])\n"`

### Étape 3 — Documenter dans `data/worlds/README.md`

Dans la section « Schéma d'un niveau », ajouter après `xp` :

```jsonc
  "solution": "code de référence\n",  // OBLIGATOIRE : sert au validateur
```

Et en bas du fichier, une section :

```markdown
## Valider les mondes

Après toute modification de contenu :

    py tools/validate_worlds.py

Le validateur vérifie le schéma, exécute chaque `solution` contre ses tests
(tout doit passer) et chaque `startCode` (il doit échouer — pas de niveau
gratuit). Rappel : tuples et sets n'existent pas en JSON → les vérifier via
des tests `expression`, jamais via `expected` de `variable`/`function`.
```

## Pièges et cas limites découverts en explorant

- **Encodage console Windows** : sans `sys.stdout.reconfigure(encoding='utf-8')`,
  les accents sortent en mojibake (constaté : `d��part` en cp1252). Le
  `errors='replace'` évite un crash si le terminal est vraiment récalcitrant.
- **La machine utilise `py`, pas `python`** (alias Microsoft Store non
  installé) — écrire `py tools/validate_worlds.py` dans toute la doc.
- **Sémantique `smart`** du compare stdout : rstrip par ligne + suppression
  des lignes vides finales — la répliquer exactement, sinon des niveaux
  valides en jeu seraient rejetés par le validateur (ou l'inverse).
- **`expression` s'évalue dans le namespace de l'élève** (après exec du code),
  avec `expected` par défaut `true` — ne pas l'oublier dans la réplique.
- **Niveaux à `input()`** : le harnais fournit `test.stdin` via
  `io.StringIO` ; sans cette redirection, le validateur bloquerait en
  attendant le clavier.
- **Le champ `solution` devient obligatoire** : le validateur échoue si
  absent — c'est voulu, ça force la discipline pour les 3 mondes restants.

## Critères d'acceptation

1. `py tools/validate_worlds.py` depuis la racine → rapport listant
   monde-0 (2 niveaux), monde-1 (9), monde-2 (9), tous `OK`, dernière ligne
   `TOUT PASSE ✔`, code retour 0 (`echo $LASTEXITCODE` → 0).
2. Casser volontairement un test (ex : dans monde-1, changer `"expected": 22`
   en `23`) → le validateur signale `monde-1/1-2 test#1 : la solution echoue`,
   code retour 1. Restaurer ensuite.
3. Vider un `startCode` requis (ex : mettre la solution de 0-1 comme
   startCode) → « niveau gratuit » détecté. Restaurer ensuite.
4. Le jeu fonctionne à l'identique dans le navigateur (champ `solution`
   ignoré par le moteur).
