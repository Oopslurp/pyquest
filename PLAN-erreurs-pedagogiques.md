# PLAN — Erreurs Python expliquées en français + entrées pour `input()`

**Rang : 2/5.** Un lycéen débutant rencontre des dizaines d'erreurs par
session. Aujourd'hui il reçoit un traceback brut (`NameError: name 'prin' is
not defined`) — en anglais, sans aide. De plus, **bug réel identifié** : en
mode « ▶ Exécuter », un code contenant `input()` plante avec `EOFError` car
le harnais fournit un stdin vide (`engine/pyrunner.js`, le harnais fait
`sys.stdin = io.StringIO('')`). Or les niveaux 1-8 et 1-9 reposent sur
`input()` : l'élève qui clique « Exécuter » avant « Valider » — réflexe
naturel — voit son programme « planter » sans comprendre.

## Objectif

1. Sous chaque erreur Python, afficher une **explication courte en français**
   adaptée au lycée (que faire, où regarder).
2. Ajouter une **zone « Entrées pour input() »** (repliable) au-dessus de la
   console : en mode Exécuter, son contenu alimente stdin (une ligne par
   `input()`).

## Fichiers à toucher

1. **Créer** `engine/errhints.js` (dictionnaire d'explications + détecteur)
2. **Modifier** `index.html` (charger errhints.js avant level.js)
3. **Modifier** `engine/pyrunner.js` (runRaw accepte un stdin)
4. **Modifier** `engine/level.js` (zone stdin + affichage des explications)
5. **Modifier** `assets/css/style.css` (styles `.stdin-box`, `.err-hint`)

Aucune modification du harnais Python : le type d'erreur se détecte côté JS
sur le texte du traceback (dernière ligne = `XxxError: message`).

## Étapes d'implémentation

### Étape 1 — Créer `engine/errhints.js`

```js
/* ============================================================
   errhints.js — explications françaises des erreurs Python
   (public : lycéen débutant). Détection sur le texte du
   traceback renvoyé par le harnais (dernière ligne).
   ============================================================ */
window.PyQuest = window.PyQuest || {};

PyQuest.ErrHints = (function () {
  const HINTS = {
    SyntaxError:      "Python n'arrive pas à lire cette ligne. Vérifie les parenthèses, les guillemets fermés, et le deux-points (:) à la fin des lignes if/for/while/def.",
    IndentationError: "Problème d'indentation : les espaces en début de ligne comptent ! Le code à l'intérieur d'un if/for/while/def doit être décalé (4 espaces).",
    TabError:         "Mélange de tabulations et d'espaces. Utilise uniquement des espaces (l'éditeur en met 4 avec la touche Tab).",
    NameError:        "Tu utilises un nom qui n'existe pas (encore). Faute de frappe ? Variable définie plus bas ? Texte oublié entre guillemets ?",
    TypeError:        "Mélange de types incompatibles — par exemple additionner du texte et un nombre. Convertis avec int(), float() ou str().",
    ValueError:       "La valeur n'a pas le bon format — souvent int(\"abc\") : on ne peut convertir en nombre que du texte qui ressemble à un nombre.",
    ZeroDivisionError:"Division par zéro : vérifie le dénominateur avant de diviser.",
    IndexError:       "Index hors limites : une liste de n éléments va de l'index 0 à n-1 (et -1 désigne le dernier).",
    KeyError:         "Cette clé n'existe pas dans le dictionnaire. Vérifie l'orthographe exacte (majuscules comprises).",
    AttributeError:   "Cette méthode/attribut n'existe pas pour ce type. Faute de frappe ? Ou la variable n'est pas du type que tu crois (ex: .append sur autre chose qu'une liste).",
    UnboundLocalError:"Tu utilises une variable dans une fonction avant de lui donner une valeur (dans cette fonction).",
    RecursionError:   "La fonction s'appelle elle-même sans fin. Il manque un cas d'arrêt.",
    ModuleNotFoundError: "Ce module n'est pas disponible ici. Les exercices se résolvent sans import.",
    ImportError:      "Cet import ne fonctionne pas ici. Les exercices se résolvent sans import.",
    EOFError:         "Ton programme lit avec input() mais aucune entrée n'est fournie. Déplie « ⌨ Entrées pour input() » au-dessus de la console et écris une ligne par input(). (Le bouton Valider, lui, fournit les entrées automatiquement.)",
  };

  /** Renvoie { type, advice } ou null. `errorText` = res.error du harnais. */
  function explain(errorText) {
    if (!errorText) return null;
    const lines = String(errorText).trim().split('\n');
    const last = lines[lines.length - 1];
    const m = last.match(/^([A-Za-z_]*(?:Error|Exception))\b/);
    const type = m ? m[1] : null;
    if (type && HINTS[type]) return { type, advice: HINTS[type] };
    return null;
  }

  return { explain };
})();
```

### Étape 2 — `index.html`

Ajouter APRÈS `engine/palette.js` et AVANT `engine/level.js` (l'ordre entre
les autres scripts est libre, mais il doit précéder level.js) :

```html
  <script src="engine/errhints.js"></script>
```

### Étape 3 — `engine/pyrunner.js` : stdin en exécution libre

Remplacer `runRaw` :

```js
  async function runRaw(source, stdin) {
    const r = await runTest(source, { type: 'stdout', expected: '', match: 'contains', stdin: stdin || '' });
    return { stdout: r.stdout, error: r.error };
  }
```

(Le harnais lit déjà `test.stdin` — aucun changement Python. Cette édition
est identique que PLAN-pyodide-worker soit appliqué ou non : dans les deux
versions, `runRaw` délègue à `runTest`.)

### Étape 4 — `engine/level.js`

**4a. Zone d'entrées.** Dans `mount()`, juste APRÈS la création de
`statusLine` et AVANT `console_`, ajouter :

```js
    const stdinArea = el('textarea', {
      class: 'stdin-input', rows: '3',
      placeholder: "Une ligne par appel à input()\nex :\n7",
    });
    const stdinBox = el('details', { class: 'stdin-box' }, [
      el('summary', {}, '⌨ Entrées pour input() (mode Exécuter)'),
      stdinArea,
    ]);
```

puis l'insérer dans `workspace` entre `statusLine` et `console_` :

```js
      editorHost,
      statusLine,
      stdinBox,
      console_,
      results,
```

**4b. Brancher stdin sur Exécuter.** Dans `execute()`, remplacer :

```js
        const { stdout, error } = await PyQuest.PyRunner.runRaw(editor.getValue());
```

par :

```js
        const { stdout, error } = await PyQuest.PyRunner.runRaw(editor.getValue(), stdinArea.value);
```

**4c. Explication d'erreur en exécution libre.** Toujours dans `execute()`,
le bloc `if (error)` devient :

```js
        if (error) {
          pre.className = 'err';
          pre.textContent = error;
          const h = PyQuest.ErrHints.explain(error);
          const old = console_.querySelector('.err-hint');
          if (old) old.remove();
          if (h) console_.appendChild(el('div', { class: 'err-hint', html: `💡 <b>${h.type}</b> — ${PyQuest.util.esc(h.advice)}` }));
        } else {
          pre.className = '';
          pre.textContent = stdout || '(aucune sortie)';
          const old = console_.querySelector('.err-hint');
          if (old) old.remove();
        }
```

**4d. Explication d'erreur dans les résultats de tests.** Dans
`renderResult()`, après le bloc `if (res.error) { detailHtml = ... }`,
enrichir : 

```js
        if (res.error) {
          detailHtml = `<b>Erreur :</b><br><code>${esc(res.error)}</code>`;
          const h = PyQuest.ErrHints.explain(res.error);
          if (h) detailHtml += `<div class="err-hint">💡 <b>${h.type}</b> — ${esc(h.advice)}</div>`;
        } else {
```

### Étape 5 — `assets/css/style.css`

Ajouter à la fin de la section « VUE NIVEAU » :

```css
.stdin-box {
  background: var(--c-night); border: 3px solid var(--panel-border);
  padding: 8px 12px; font-size: 9px; color: var(--c-silver);
}
.stdin-box summary { cursor: pointer; }
.stdin-input {
  width: 100%; margin-top: 8px; background: var(--c-night);
  color: var(--c-cyan); border: 2px solid var(--c-deep);
  font-family: var(--font-mono); font-size: 13px; padding: 6px;
  resize: vertical;
}
.err-hint {
  margin-top: 8px; padding: 8px 10px;
  background: var(--c-night); border-left: 4px solid var(--c-sky);
  color: var(--c-silver); font-size: 12px; line-height: 1.7;
  font-family: var(--font-mono);
}
```

## Pièges et cas limites découverts en explorant

- **La détection doit se faire sur la DERNIÈRE ligne** du texte d'erreur :
  `_clean_tb()` du harnais peut préfixer des lignes « ligne N : … » ; le type
  (`NameError: …`) est toujours en dernière ligne.
- **Cas sans exception** : « La variable 'x' n'a pas été définie. » et
  « La fonction 'f' n'a pas été définie. » sont générés par le harnais SANS
  type d'erreur → `explain()` renvoie `null`, rien ne s'affiche (c'est déjà
  un message français clair). Ne pas essayer de les mapper.
- **`esc()` sur l'advice** mais PAS sur le HTML englobant : les advices
  contiennent des guillemets et chevrons potentiels ; l'HTML des hints est
  construit par nous, le texte vient du dictionnaire → échapper par sécurité
  (voir code 4c/4d).
- **Ne pas passer `stdinArea.value` à `validate()`** : les tests JSON
  fournissent leur propre `stdin` — c'est voulu (reproductibilité).
- **`old.remove()`** avant chaque affichage : sinon les hints s'empilent à
  chaque clic sur Exécuter.
- **SyntaxError** : le traceback de compilation (`compile(source, '<student>')`)
  n'a pas de frame `<student>` dans `extract_tb` → seule la dernière ligne
  `SyntaxError: invalid syntax` apparaît. La détection fonctionne quand même.

## Critères d'acceptation

1. `node --check` passe sur `engine/errhints.js` et `engine/level.js`.
2. Code `prin("x")` + Exécuter → traceback brut + encadré bleu
   « 💡 NameError — Tu utilises un nom qui n'existe pas… ».
3. Code `int("abc")` + Valider → chaque test rouge affiche l'encadré
   « 💡 ValueError… » sous l'erreur brute.
4. Niveau 1-8 : taper la solution, cliquer **Exécuter** SANS remplir la zone
   d'entrées → encadré « 💡 EOFError — … déplie ⌨ Entrées pour input()… ».
5. Déplier la zone, écrire `7`, re-cliquer Exécuter → la console affiche
   « Le double est 14 », plus aucun hint affiché.
6. **Valider** sur 1-8 fonctionne toujours (stdin des tests JSON intact).
7. Un code sans erreur n'affiche jamais d'encadré 💡.
