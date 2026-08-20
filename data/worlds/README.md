# Schéma d'un « monde » PyQuest

Tout le contenu pédagogique vit ici, en JSON. Le moteur (`/engine`) est
générique : pour ajouter un monde, il suffit d'ajouter un fichier ici et de
le référencer dans `manifest.json`. Aucune ligne de code à toucher.

## `manifest.json`

Liste ordonnée des mondes et leur placement sur la carte.

```jsonc
{
  "worlds": [
    {
      "id": "monde-0",            // identifiant unique
      "title": "Île du Réveil",   // nom affiché
      "description": "…",         // court texte
      "file": "monde-0-test.json",// fichier du monde (null = « bientôt »)
      "requires": null,           // id du monde requis (null = déverrouillé)
      "color": "#41a6f6",         // couleur du médaillon (palette Sweetie-16)
      "theme": "village",         // décor dessiné sur l'île (engine/overworld.js)
      "banner": "assets/…/banner.svg", // bandeau du panneau de monde
      "npc": "assets/…/villager.svg",  // sprite affiché à côté de l'énoncé
      "node": { "x": 13, "y": 68 }// position sur la carte, en % (0–100)
    }
  ]
}
```

- Un monde est **déverrouillé** si `requires` vaut `null` ou si le monde requis
  est **entièrement terminé**.
- Un monde est **terminé** quand tous ses niveaux sont réussis.

### La carte est un graphe, pas une ligne

Le tracé en pointillés se déduit des `requires` : **un segment par relation**,
et non une polyline suivant l'ordre du tableau. Plusieurs mondes peuvent donc
pointer vers le même prérequis, ce qui dessine un **embranchement**. C'est ainsi
que la carte se sépare après le Village :

- **branche maths** (programme du bac de spécialité) : `monde-6` → `monde-7` ;
- **branche informatique** : `monde-2` → `monde-3` → `monde-4` → `monde-5`.

L'ordre dans le tableau ne sert plus qu'à deux choses : le numéro affiché sur le
médaillon, et l'ordre de la liste. Les `id` n'ont donc pas à suivre les
positions (`monde-6` est en 3ᵉ position — les clés de sauvegarde restent
`monde-6::6-1`, intactes).

> **Contrainte de placement** : les îlots sont dessinés à
> `node.y × hauteur + 14`, sous un horizon situé à mi-hauteur. Tout nœud placé
> **au-dessus de `y = 46`** verrait son île flotter dans le ciel. Garder
> `46 ≤ node.y ≤ 82`.

## Fichier d'un monde

```jsonc
{
  "id": "monde-0",
  "title": "Île du Réveil",
  "description": "…",
  "levels": [ /* voir ci-dessous */ ]
}
```

## Schéma d'un niveau

```jsonc
{
  "id": "0-1",                 // unique dans le monde
  "solution": "print(\"…\")\n",// OBLIGATOIRE : code de référence, sert au validateur
  "title": "Premier signal",
  "statement": "<p>Énoncé en HTML…</p>", // <code>, <pre>, <strong> autorisés
  "startCode": "# code de départ\n",     // pré-rempli dans l'éditeur
  "xp": 20,                    // XP gagnés à la première réussite
  "hints": ["indice 1", "indice 2"],     // révélés progressivement
  "tests": [ /* voir ci-dessous */ ]     // TOUS doivent passer pour réussir
}
```

> Le champ `"solution"` n'est **pas** utilisé par le jeu (le moteur l'ignore) :
> il sert uniquement au validateur (voir « Valider les mondes » plus bas).

Un niveau est **débloqué** si c'est le premier du monde, ou si le niveau
précédent est réussi.

## Types de tests

Chaque test s'exécute dans un espace de noms Python **neuf** (pas de fuite
entre tests). Champ commun optionnel : `"description"` (affiché à l'élève).

### 1. `stdout` — comparer la sortie imprimée
```jsonc
{
  "type": "stdout",
  "description": "Affiche le bon message",
  "expected": "Bonjour !",
  "stdin": "",            // optionnel : alimente input()
  "match": "smart"        // "smart" (défaut) | "exact" | "contains" | "regex"
}
```
`smart` ignore les espaces en fin de ligne et les lignes vides finales.

### 2. `variable` — vérifier la valeur d'une variable
```jsonc
{
  "type": "variable",
  "name": "total",
  "expected": 42,
  "tol": 0.001            // optionnel : tolérance pour les flottants
}
```

### 3. `function` — appeler une fonction et vérifier son retour
```jsonc
{
  "type": "function",
  "name": "addition",
  "args": [2, 3],
  "expected": 5,
  "tol": 0.001            // optionnel
}
```

### 4. `expression` — évaluer une expression Python
```jsonc
{
  "type": "expression",
  "expression": "carre(4) == 16",
  "expected": true        // défaut : true
}
```
L'expression est évaluée **après** le code de l'élève, dans le même espace
de noms (elle voit donc ses variables et fonctions).

## Valider les mondes

Après toute modification de contenu, lancer **les deux** outils :

    py tools/validate_worlds.py
    py tools/check_cheats.py

`validate_worlds.py` vérifie le schéma, exécute chaque `solution` contre ses
tests (tout doit passer) et chaque `startCode` (il doit échouer — pas de niveau
gratuit).

`check_cheats.py` fait l'inverse, et c'est aussi important : il rejoue des
solutions **volontairement fausses** (bornes de notes décalées, filtre sans
`sorted()`, `in` interdit par l'énoncé, recherche linéaire au lieu d'une
dichotomie…) et exige qu'elles **échouent**. Un test qui accepte une mauvaise
réponse est pire qu'un test absent : l'élève apprend faux sans le savoir. En
ajoutant un niveau, se demander toujours *quelle mauvaise solution passerait*,
et l'ajouter à cette liste.

Les deux sortent en code 0 si tout est vert, 1 sinon.

### Tester un niveau qui utilise le hasard

Le harnais ne peut pas fixer la graine du code de l'élève : un test ne doit
donc jamais attendre une valeur précise. Les niveaux du Monde 7 s'appuient sur
trois procédés, dans cet ordre de préférence :

1. **des ancres déterministes** — avec `p = 1` ou `p = 0`, `marge = 0`, ou la
   parité d'une marche aléatoire, le résultat est certain ;
2. **des invariants** — bornes (`1 <= de() <= 6`), longueur, nombre de valeurs
   distinctes rencontrées sur beaucoup de tirages ;
3. **des bornes statistiques très larges** — au moins 8 écarts-types, pour que
   la probabilité d'un faux échec soit négligeable.

Vérifier ensuite la stabilité en rejouant plusieurs fois les tests du monde
contre sa solution de référence : aucun échec ne doit apparaître.

> **Piège JSON** : tuples et sets n'existent pas en JSON. Un test
> `variable`/`function` dont la valeur attendue est un tuple/set échouera
> toujours (`(2, 1) == [2, 1]` est faux en Python). Vérifier ces valeurs via
> un test `expression` (ex. `"stand == (\"Fruits\", 12)"`). Le validateur
> affiche une `[note]` sur tout `expected` de type liste pour le rappeler.
