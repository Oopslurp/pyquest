# PLAN — Rythme des indices + raccourcis clavier

**Rang : 4/5.** Problème pédagogique réel repéré dans `engine/level.js`
(fin de `validate()`) : **à chaque validation échouée, un indice est révélé
automatiquement**. Or les mondes 1 et 2 ont 2 indices par niveau, et le
2ᵉ indice contient la solution quasi complète. Conséquence : deux échecs
= solution offerte. L'élève apprend vite à cliquer Valider deux fois au
lieu de réfléchir. À corriger avant que l'habitude ne s'installe.
S'y ajoutent deux raccourcis clavier (gros confort quotidien) et la
fermeture des panneaux au clavier.

## Objectif

1. **Indices** : plus aucune révélation automatique de la solution.
   - L'indice n°1 se révèle automatiquement seulement au **2ᵉ échec** (et
     seulement si aucun indice n'est encore visible).
   - Les indices suivants : uniquement via le bouton 💡.
   - Le DERNIER indice (= la solution) demande une **confirmation** : premier
     clic → le bouton affiche « Révéler la solution ? » ; second clic → révélé.
2. **Raccourcis** : `Ctrl+Entrée` = Valider, `Alt+Entrée` = Exécuter
   (depuis l'éditeur), `Échap` = fermer le panneau monde.
3. Compter les tentatives par niveau (persisté — utile plus tard pour des
   statistiques parent).

## Fichiers à toucher

1. **Modifier** `engine/storage.js` (champ `attempts`)
2. **Modifier** `engine/level.js` (logique indices + raccourcis + statut)
3. **Modifier** `engine/game.js` (touche Échap pour le panneau monde)

## Étapes d'implémentation

### Étape 1 — `engine/storage.js`

Dans `makeDefault()`, ajouter `attempts` :

```js
    return { version: 1, xp: 0, completed: {}, code: {}, hintsSeen: {}, attempts: {}, muted: false };
```

Aucune migration nécessaire : `load()` fait déjà
`Object.assign(makeDefault(), s)`, donc les sauvegardes existantes reçoivent
`attempts: {}` automatiquement.

### Étape 2 — `engine/level.js`

**2a. Confirmation sur le dernier indice.** Remplacer ENTIÈREMENT la
fonction `revealHint()` existante par :

```js
    let armed = false; // premier clic sur le dernier indice = confirmation
    function revealHint(auto) {
      if (hintsShown >= hints.length) return;
      const isLast = hintsShown === hints.length - 1;
      if (isLast && !auto && !armed) {
        armed = true;
        hintBtn.textContent = '💡 Révéler la solution ?';
        setTimeout(() => { // désarme après 4 s sans second clic
          if (armed) { armed = false; renderHints(); }
        }, 4000);
        return;
      }
      if (isLast && auto) return; // JAMAIS la solution automatiquement
      armed = false;
      hintsShown++;
      game.state.hintsSeen[key] = hintsShown;
      game.save();
      renderHints();
      Audio.click();
    }
```

Note : `renderHints()` réécrit le libellé du bouton — c'est ce qui « désarme »
visuellement. Ne pas modifier `renderHints()`.

**2b. Révélation automatique au 2ᵉ échec seulement.** Dans `validate()`,
remplacer :

```js
        setBusy(false, 'Pas encore… regarde les tests en rouge.');
        Audio.fail();
        // Révèle un indice supplémentaire à chaque échec (jusqu'au max).
        if (hintsShown < hints.length) revealHint();
```

par :

```js
        const tries = (game.state.attempts[key] = (game.state.attempts[key] || 0) + 1);
        game.save();
        setBusy(false, tries >= 2
          ? 'Pas encore… pense au bouton 💡 Indice.'
          : 'Pas encore… regarde les tests en rouge.');
        Audio.fail();
        // Seul le PREMIER indice se révèle automatiquement, au 2e échec.
        if (tries === 2 && hintsShown === 0 && hints.length > 0) revealHint(true);
```

**2c. Raccourcis clavier Monaco.** Dans `mount()`, juste APRÈS le bloc
`editor = monaco.editor.create(...)` (et après le filet `ensureFont`),
ajouter :

```js
    // Raccourcis : Ctrl+Entrée = Valider, Alt+Entrée = Exécuter.
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => validate());
    editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.Enter, () => execute());
```

(`execute` et `validate` sont des déclarations de fonction dans `mount()` :
le hoisting les rend visibles ici, même si elles sont définies plus bas.)

**2d. Afficher les raccourcis.** Remplacer le texte initial de la ligne de
statut :

```js
    const statusLine = el('div', { class: 'editor-status' }, 'Écris ton code, puis « Valider ».');
```

par :

```js
    const statusLine = el('div', { class: 'editor-status' },
      'Ctrl+Entrée : valider · Alt+Entrée : exécuter');
```

### Étape 3 — `engine/game.js` : Échap ferme le panneau monde

Dans le `window.addEventListener('DOMContentLoaded', ...)` en bas du fichier,
après le listener `wp.addEventListener('click', ...)`, ajouter :

```js
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !wp.classList.contains('hidden')) {
      wp.classList.add('hidden');
      PyQuest.Audio.click();
    }
  });
```

## Pièges et cas limites découverts en explorant

- **`revealHint` est appelé à DEUX endroits** : par le bouton 💡 (clic
  utilisateur) et par `validate()` (automatique). D'où le paramètre `auto` :
  l'appel automatique ne doit JAMAIS pouvoir révéler le dernier indice, ni
  déclencher l'armement de confirmation.
- **Cas 1 seul indice** (`hints.length === 1`) : l'unique indice EST le
  dernier → jamais auto-révélé, confirmation au clic. C'est le comportement
  voulu (mondes futurs pourraient n'avoir qu'un indice-solution).
- **`hintsShown` est restauré depuis la sauvegarde** au montage
  (`game.state.hintsSeen[key]`) : un élève qui a déjà vu la solution la
  revoit au remontage — ne pas « réarmer » la confirmation pour les indices
  déjà vus (le code ci-dessus gère ça naturellement : `renderHints()` répète
  les indices déjà comptés).
- **Ne pas brancher les raccourcis sur `document`** mais sur l'éditeur
  (`editor.addCommand`) : sinon Ctrl+Entrée déclencherait la validation
  depuis n'importe quel écran, y compris l'overworld, avec un `editor`
  disposé → crash.
- **`Audio.fail()` puis `revealHint(true)`** : `revealHint` joue
  `Audio.click()` — les deux sons s'enchaînent, c'est acceptable ; ne pas
  « corriger » en supprimant le click, il confirme la révélation.
- **`attempts` compte aussi les échecs pour erreur de syntaxe** (pas
  seulement les tests rouges) : c'est voulu — une erreur de syntaxe est
  aussi une tentative.

## Critères d'acceptation

1. `node --check` passe sur les 3 fichiers modifiés.
2. Niveau 1-1, code faux + Valider : **aucun** indice ne s'affiche au
   1ᵉʳ échec. Au 2ᵉ échec : l'indice n°1 apparaît seul.
3. 3ᵉ, 4ᵉ… échec : rien de plus ne se révèle automatiquement.
4. Bouton 💡 : premier clic sur le dernier indice → libellé
   « 💡 Révéler la solution ? » ; attendre 5 s → le libellé redevient normal
   sans rien révéler ; deux clics rapprochés → la solution s'affiche.
5. `Ctrl+Entrée` dans l'éditeur valide ; `Alt+Entrée` exécute ; les deux
   ne font rien depuis la carte (pas d'erreur console).
6. `Échap` ferme le panneau monde ; ne fait rien s'il est déjà fermé.
7. Recharger la page : compteur de tentatives et indices vus persistent
   (localStorage), une vieille sauvegarde (sans `attempts`) charge sans
   erreur.
