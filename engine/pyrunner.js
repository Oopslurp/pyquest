/* ============================================================
   pyrunner.js — client du worker Python (engine/pyworker.js)
   ------------------------------------------------------------
   Exécution hors thread principal + délai d'expiration : une
   boucle infinie ne gèle plus l'onglet. En cas de dépassement,
   on tue le worker et on en relance un neuf immédiatement.

   API publique conservée : init / runTest / runRaw / isReady.
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
        if (m.type === 'progress') {
          if (onProgressCb) onProgressCb(m.msg);
        } else if (m.type === 'ready') {
          ready = true;
          resolve();
        } else if (m.type === 'result') {
          const p = pending.get(m.id);
          if (p) {
            clearTimeout(p.timer);
            pending.delete(m.id);
            p.resolve(JSON.parse(m.json));
          }
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

  /** Exécute `source` contre un `test` (objet). Renvoie
   *  { ok, error, stdout, got, expected }. Rejette avec une erreur
   *  `.isTimeout` si le délai est dépassé (boucle infinie). */
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

  /** Exécution libre (bouton « Exécuter ») : renvoie { stdout, error }. */
  async function runRaw(source, stdin) {
    const r = await runTest(source, { type: 'stdout', expected: '', match: 'contains', stdin: stdin || '' });
    return { stdout: r.stdout, error: r.error };
  }

  return { init, runTest, runRaw, isReady: () => ready };
})();
