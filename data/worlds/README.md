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
      "node": { "x": 13, "y": 68 }// position sur la carte, en % (0–100)
    }
  ]
}
```

- Un monde est **déverrouillé** si `requires` vaut `null` ou si le monde requis
  est **entièrement terminé**.
- Un monde est **terminé** quand tous ses niveaux sont réussis.

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
  "title": "Premier signal",
  "statement": "<p>Énoncé en HTML…</p>", // <code>, <pre>, <strong> autorisés
  "startCode": "# code de départ\n",     // pré-rempli dans l'éditeur
  "xp": 20,                    // XP gagnés à la première réussite
  "hints": ["indice 1", "indice 2"],     // révélés progressivement
  "tests": [ /* voir ci-dessous */ ]     // TOUS doivent passer pour réussir
}
```

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
