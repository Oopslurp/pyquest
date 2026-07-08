# PLAN — Pyodide dans un Web Worker avec délai d'expiration

**Rang : 1/5 (à faire en premier).** Un élève qui apprend `while` écrira une
boucle infinie dans les minutes qui suivent (le niveau 1-7 du Monde 1 porte
précisément sur `while`). Aujourd'hui, cela **gèle l'onglet entier** : Pyodide
tourne sur le thread principal. C'est la seule vraie bombe à retardement de
l'app, et elle est documentée comme « Limite connue (v1) » dans `README.md`.

## Objectif

Exécuter le code Python dans un **Web Worker**. Si une exécution dépasse un
délai (6 s par défaut), on **termine le worker** (`worker.terminate()`), on
affiche un message clair « boucle infinie ? », et on **relance immédiatement**
un worker neuf en arrière-plan. L'UI ne gèle jamais.

## Décision d'architecture (NE PAS dévier)

Utiliser **terminate + respawn**, PAS `interruptBuffer`/`SharedArrayBuffer`.
Raison : `SharedArrayBuffer` exige les en-têtes COOP/COEP (cross-origin
isolation) que ni `python -m http.server` ni GitHub Pages n'envoient. Un
modèle qui proposerait `pyodide.setInterruptBuffer` se tromperait : ça ne
marchera pas dans cet environnement de déploiement.

## Fichiers à toucher

1. **Créer** `engine/pyworker.js` (script du worker)
2. **Réécrire** `engine/pyrunner.js` (devient un client du worker)
3. **Modifier** `engine/level.js` (gestion du timeout dans `validate()`)
4. **Modifier** `index.html` (retirer le `<script>` pyodide.js du thread principal)
5. **Modifier** `README.md` (retirer la section « Limite connue (v1) »)

## Étapes d'implémentation (dans cet ordre)

### Étape 1 — Créer `engine/pyworker.js`

```js
/* ============================================================
   pyworker.js — Web Worker : Pyodide + harnais de tests.
   Tourne hors du thread principal ; tué par pyrunner.js en cas
   de dépassement de délai (boucle infinie), puis relancé.
   ============================================================ */
const PYODIDE_URL = 'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/';
importScripts(PYODIDE_URL + 'pyodide.js');

const HARNESS = String.raw`
...COLLER ICI, À L'IDENTIQUE, la constante HARNESS de l'ancien
engine/pyrunner.js (tout le bloc Python entre les backticks,
de "import sys, io, json, traceback" à "_pyquest_run_json"). NE RIEN MODIFIER.
`;

let pyodide = null;

async function boot() {
  postMessage({ type: 'progress', msg: 'Chargement du moteur Python (Pyodide)…' });
  pyodide = await loadPyodide({ indexURL: PYODIDE_URL });
  postMessage({ type: 'progress', msg: "Préparation de l'environnement Python…" });
  await pyodide.runPythonAsync(HARNESS);
  postMessage({ type: 'ready' });
}
const bootPromise = boot();

onmessage = async (e) => {
  const m = e.data;
  if (m.type !== 'run') return;
  await bootPromise;
  let json;
  const fn = pyodide.globals.get('_pyquest_run_json');
  try {
    json = fn(m.source, JSON.stringify(m.test));
  } catch (err) {
    json = JSON.stringify({ ok: false, error: String(err), stdout: '', got: null, expected: null });
  } finally {
    fn.destroy();
  }
  postMessage({ type: 'result', id: m.id, json });
};
```

Note : `importScripts` cross-origin vers le CDN est autorisé dans un worker
classique (ce n'est pas un module worker — ne pas utiliser `type: 'module'`).

### Étape 2 — Réécrire `engine/pyrunner.js`

Remplacer TOUT le contenu par ce client (l'API publique `init / runTest /
runRaw / isReady` est conservée à l'identique pour ne pas toucher `game.js`) :

```js
/* ============================================================
   pyrunner.js — client du worker Python (engine/pyworker.js)
   Exécution hors thread principal + délai d'expiration :
   une boucle infinie ne gèle plus l'onglet.
   ============================================================ */
window.PyQuest = window.PyQuest || {};

PyQuest.PyRunner = (function () {
  const WORKER_URL = 'engine/pyworker.js';
  const DEFAULT_TIMEOUT_MS = 6000;

  let worker = null;
  let readyPromise = null;
  let ready = false;
  let onProgressCb = null;
  let seq = 0;
  const pending = new Map(); // id -> { resolve, reject, timer }

  function timeoutError(ms) {
    const e = new Error(
      '⏱ Temps dépassé (' + Math.round(ms / 1000) + ' s) — boucle infinie ? ' +
      'Vérifie la condition de ta boucle. (Le moteur Python redémarre…)'
    );
    e.isTimeout = true;
    return e;
  }

  function spawn() {
    ready = false;
    worker = new Worker(WORKER_URL);
    readyPromise = new Promise((resolve) => {
      worker.onmessage = (e) => {
        const m = e.data;
        if (m.type === 'progress') { if (onProgressCb) onProgressCb(m.msg); }
        else if (m.type === 'ready') { ready = true; resolve(); }
        else if (m.type === 'result') {
          const p = pending.get(m.id);
          if (p) { clearTimeout(p.timer); pending.delete(m.id); p.resolve(JSON.parse(m.json)); }
        }
      };
    });
  }

  function killAndRespawn(ms) {
    worker.terminate();
    const err = timeoutError(ms);
    pending.forEach((p) => { clearTimeout(p.timer); p.reject(err); });
    pending.clear();
    spawn(); // relance immédiate : le moteur se réchauffe pendant que l'élève corrige
  }

  async function init(onProgress) {
    onProgressCb = onProgress || onProgressCb;
    if (!worker) spawn();
    await readyPromise;
    if (onProgress) onProgress('Python prêt.');
  }

  async function runTest(source, test) {
    if (!worker) spawn();
    await readyPromise; // le chrono ne démarre qu'une fois le moteur prêt
    const ms = test.timeoutMs || DEFAULT_TIMEOUT_MS;
    return new Promise((resolve, reject) => {
      const id = ++seq;
      const timer = setTimeout(() => killAndRespawn(ms), ms);
      pending.set(id, { resolve, reject, timer });
      worker.postMessage({ type: 'run', id, source, test });
    });
  }

  async function runRaw(source) {
    const r = await runTest(source, { type: 'stdout', expected: '', match: 'contains' });
    return { stdout: r.stdout, error: r.error };
  }

  return { init, runTest, runRaw, isReady: () => ready };
})();
```

### Étape 3 — `engine/level.js` : arrêt propre de la validation après timeout

Dans `validate()`, remplacer la boucle :

```js
      for (const test of tests) {
        try {
          outcomes.push({ test, res: await PyQuest.PyRunner.runTest(code, test) });
        } catch (e) {
          outcomes.push({ test, res: { ok: false, error: String(e) } });
        }
      }
```

par :

```js
      for (const test of tests) {
        try {
          outcomes.push({ test, res: await PyQuest.PyRunner.runTest(code, test) });
        } catch (e) {
          outcomes.push({ test, res: { ok: false, error: e.message || String(e) } });
          if (e.isTimeout) {
            // Ne pas attendre la relance du moteur pour chaque test restant.
            tests.slice(outcomes.length).forEach((t2) => {
              outcomes.push({ test: t2, res: { ok: false, error: 'Non exécuté (délai dépassé au test précédent).' } });
            });
            break;
          }
        }
      }
```

Sans ce `break`, chaque test restant attendrait ~10 s la ré-initialisation de
Pyodide : 3 tests = 30 s de blocage apparent. C'est le piège principal.

### Étape 4 — `index.html`

Supprimer la ligne (Pyodide n'est plus chargé sur le thread principal ;
le worker charge sa propre copie) :

```html
  <script src="https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.js"></script>
```

Ne PAS ajouter de `<script>` pour `pyworker.js` : il est chargé par
`new Worker(...)`, pas comme script de page.

### Étape 5 — `README.md`

Supprimer la section « ## Limite connue (v1) » et la remplacer par une ligne
dans la description : le code s'exécute dans un Web Worker avec délai de 6 s.

## Pièges et cas limites découverts en explorant

- **`String.raw`** dans le HARNESS : indispensable (le Python contient `\n`,
  `\r` littéraux dans `_norm`). Le déplacer tel quel, avec `String.raw`.
- **Le chrono après `readyPromise`** : si on arme le timeout avant que le
  worker soit prêt, la première validation après un respawn (init ~5-15 s)
  serait faussement comptée comme boucle infinie.
- **`game.js` n'est pas à toucher** : `init(onProgress)` garde sa signature ;
  la barre de boot continue de recevoir les messages de progression.
- **`test.timeoutMs`** : champ optionnel par test (les futurs mondes pourront
  l'augmenter pour des exercices lourds). Le documenter dans
  `data/worlds/README.md` (une ligne dans « Champ commun optionnel »).
- **Workers et `file://`** : ne fonctionne pas — mais l'app exige déjà un
  serveur HTTP (fetch des JSON), donc rien ne change.
- **URL relative du worker** : `new Worker('engine/pyworker.js')` se résout
  par rapport à `index.html` → OK en local et sur GitHub Pages (sous-chemin).

## Critères d'acceptation (vérifiables un à un)

1. `node --check engine/pyrunner.js` passe (et le worker n'a pas d'erreur de
   syntaxe : l'app démarre).
2. Boot normal : barre de progression avec messages Pyodide, bouton
   « Commencer » apparaît, monde-0 niveau 0-1 se valide (test vert, +XP).
3. Taper `while True: pass`, cliquer **Exécuter** : l'UI reste fluide
   (la carte, les boutons répondent) ; après ~6 s, message « ⏱ Temps
   dépassé… boucle infinie ? » dans la console du niveau.
4. Juste après (sans recharger), corriger le code et cliquer **Valider** :
   ça fonctionne (le worker relancé finit de s'initialiser puis exécute).
5. `while True: pass` puis **Valider** sur un niveau à 3 tests : le premier
   test affiche le message de timeout, les suivants « Non exécuté… », le
   tout en ~6 s (pas 18 s), sans gel.
6. Recharger la page n'est jamais nécessaire pendant tout le scénario.
