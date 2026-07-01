/* ============================================================
   storage.js — sauvegarde de la progression en localStorage
   ------------------------------------------------------------
   Forme de l'état :
   {
     version: 1,
     xp: 0,
     completed: { "monde-0::0-1": true, ... },   // niveaux réussis
     code:      { "monde-0::0-1": "…" },          // dernier code saisi
     hintsSeen: { "monde-0::0-1": 2 },            // nb d'indices révélés
     muted: false
   }
   ============================================================ */
window.PyQuest = window.PyQuest || {};

PyQuest.Storage = (function () {
  const KEY = 'pyquest.save.v1';

  function makeDefault() {
    return { version: 1, xp: 0, completed: {}, code: {}, hintsSeen: {}, muted: false };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return makeDefault();
      const s = JSON.parse(raw);
      // fusion défensive : garantit la présence de tous les champs.
      return Object.assign(makeDefault(), s);
    } catch (e) {
      console.warn('Sauvegarde illisible, réinitialisation.', e);
      return makeDefault();
    }
  }

  function save(state) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('Échec de sauvegarde.', e);
    }
  }

  function reset() {
    localStorage.removeItem(KEY);
  }

  return { load, save, reset, makeDefault };
})();
