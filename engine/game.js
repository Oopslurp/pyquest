/* ============================================================
   game.js — orchestrateur principal de PyQuest
   ------------------------------------------------------------
   Boot (Pyodide + Monaco) -> chargement des données -> overworld.
   Gère la navigation, le HUD, la sauvegarde et la logique de
   déverrouillage (mondes / niveaux) déduite du manifest.
   ============================================================ */
window.PyQuest = window.PyQuest || {};

// Police de CODE partagée : une vraie monospace (jamais la police pixel de l'UI).
// La 1re famille est une web font ; elle sert aussi de référence pour précharger
// les métriques avant que Monaco ne mesure les caractères.
PyQuest.CODE_FONT_FAMILY = 'JetBrains Mono';
PyQuest.CODE_FONT = "'JetBrains Mono', 'Fira Code', Consolas, 'Courier New', monospace";

PyQuest.Game = (function () {
  const { $, el, esc, fetchJSON, showScreen } = PyQuest.util;
  const Storage = PyQuest.Storage;
  const Audio = PyQuest.Audio;

  const MONACO_BASE = 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min';

  const TIPS = [
    'Astuce : le bouton « Exécuter » lance ton code, « Valider » vérifie les tests.',
    'Astuce : ta progression est sauvegardée automatiquement dans le navigateur.',
    'Astuce : bloqué ? Révèle un indice, sans honte !',
    'Astuce : en Python, l\'indentation (les espaces au début) compte vraiment.',
  ];

  const Game = {
    state: null,
    manifest: null,
    worlds: {},       // id -> données du monde (JSON chargé)
    currentWorldId: null,

    /* ---------------- Boot ---------------- */
    async init() {
      const fill = $('#boot-fill');
      const status = $('#boot-status');
      $('#boot-tip').textContent = TIPS[Math.floor(Math.random() * TIPS.length)];

      let prog = 5;
      const setProg = (p, msg) => { prog = p; fill.style.width = p + '%'; if (msg) status.textContent = msg; };

      try {
        setProg(10, 'Chargement du moteur Python…');
        await Promise.all([
          PyQuest.PyRunner.init((m) => { setProg(Math.min(prog + 15, 70), m); }),
          this.loadMonaco((m) => setProg(Math.min(prog + 10, 75), m)),
        ]);

        setProg(82, 'Chargement des mondes…');
        this.state = Storage.load();
        Audio.setMuted(!!this.state.muted);
        this.manifest = await fetchJSON('data/worlds/manifest.json');

        // Précharge tous les mondes qui possèdent un fichier
        // (nécessaire pour calculer les déverrouillages).
        await Promise.all(
          this.manifest.worlds
            .filter((w) => w.file)
            .map(async (w) => {
              try { this.worlds[w.id] = await fetchJSON('data/worlds/' + w.file); }
              catch (e) { console.warn('Monde illisible :', w.id, e); }
            })
        );

        setProg(100, 'Prêt !');
        this.wireHud();
        this.renderOverworld();

        // Le bouton « Commencer » sert aussi de geste pour activer l'audio.
        const startBtn = $('#boot-start');
        startBtn.classList.remove('hidden');
        status.textContent = 'Tout est prêt.';
        startBtn.onclick = () => {
          Audio.unlock(); Audio.click();
          $('#hud').classList.remove('hidden');
          showScreen('overworld');
        };
      } catch (e) {
        console.error(e);
        status.textContent = 'Erreur de chargement : ' + e.message;
        status.style.color = PyQuest.Palette.named.orange;
      }
    },

    loadMonaco(onProgress) {
      return new Promise((resolve, reject) => {
        onProgress && onProgress("Chargement de l'éditeur…");
        // Contournement worker cross-origin (Monaco via CDN).
        window.MonacoEnvironment = {
          getWorkerUrl: function () {
            return `data:text/javascript;charset=utf-8,${encodeURIComponent(
              `self.MonacoEnvironment={baseUrl:'${MONACO_BASE}/'};` +
              `importScripts('${MONACO_BASE}/vs/base/worker/workerMain.js');`
            )}`;
          },
        };
        require.config({ paths: { vs: MONACO_BASE + '/vs' } });
        require(['vs/editor/editor.main'], async () => {
          monaco.editor.defineTheme('pyquest', {
            base: 'vs-dark',
            inherit: true,
            rules: [
              { token: 'comment', foreground: '566c86', fontStyle: 'italic' },
              { token: 'keyword', foreground: 'ef7d57' },
              { token: 'string', foreground: 'a7f070' },
              { token: 'number', foreground: '73eff7' },
              { token: 'delimiter', foreground: '94b0c2' },
            ],
            colors: {
              'editor.background': '#1a1c2c',
              'editor.foreground': '#f4f4f4',
              'editorLineNumber.foreground': '#566c86',
              'editor.lineHighlightBackground': '#20223480',
              'editorCursor.foreground': '#ffcd75',
              'editor.selectionBackground': '#3b5dc966',
            },
          });
          // IMPORTANT : la police de CODE doit être chargée AVANT que Monaco
          // mesure la largeur des caractères, sinon le curseur se décale
          // (il mesure la police de secours puis peint avec la vraie).
          onProgress && onProgress('Chargement de la police de code…');
          await PyQuest.util.ensureFont(PyQuest.CODE_FONT_FAMILY, ['14px', '600 14px']);
          try { monaco.editor.remeasureFonts(); } catch (e) { /* noop */ }
          resolve(window.monaco);
        }, reject);
      });
    },

    /* ---------------- HUD ---------------- */
    wireHud() {
      const muteBtn = $('#btn-mute');
      const resetBtn = $('#btn-reset');
      muteBtn.textContent = this.state.muted ? '🔇' : '🔊';
      muteBtn.onclick = () => {
        const m = !this.state.muted;
        this.state.muted = m; Audio.setMuted(m); this.save();
        muteBtn.textContent = m ? '🔇' : '🔊';
        if (!m) Audio.click();
      };
      resetBtn.onclick = () => {
        if (confirm('Réinitialiser toute la progression ? Cette action est irréversible.')) {
          Storage.reset();
          this.state = Storage.load();
          Audio.setMuted(!!this.state.muted);
          this.updateHUD();
          this.renderOverworld();
          showScreen('overworld');
          $('#world-panel').classList.add('hidden');
        }
      };
      this.updateHUD();
    },

    updateHUD() {
      const xp = this.state.xp || 0;
      const level = Math.floor(xp / 100) + 1;
      const into = xp % 100;
      $('#hud-level').textContent = 'Niv. ' + level;
      $('#hud-xp-fill').style.width = into + '%';
      $('#hud-xp-text').textContent = xp + ' XP';
    },

    save() { Storage.save(this.state); },

    /* ---------------- Logique de progression ---------------- */
    levelKey(worldId, levelId) { return worldId + '::' + levelId; },

    isLevelDone(worldId, levelId) {
      return !!this.state.completed[this.levelKey(worldId, levelId)];
    },

    entry(worldId) { return this.manifest.worlds.find((w) => w.id === worldId); },

    isWorldComplete(worldId) {
      const world = this.worlds[worldId];
      if (!world || !Array.isArray(world.levels) || !world.levels.length) return false;
      return world.levels.every((lv) => this.isLevelDone(worldId, lv.id));
    },

    isWorldUnlocked(worldEntry) {
      if (!worldEntry.requires) return true;
      return this.isWorldComplete(worldEntry.requires);
    },

    unlockedSet() {
      const s = new Set();
      this.manifest.worlds.forEach((w) => { if (this.isWorldUnlocked(w)) s.add(w.id); });
      return s;
    },

    worldStates() {
      return this.manifest.worlds.map((entry) => {
        const world = this.worlds[entry.id];
        const total = world ? world.levels.length : 0;
        const done = world ? world.levels.filter((lv) => this.isLevelDone(entry.id, lv.id)).length : 0;
        return {
          entry,
          unlocked: this.isWorldUnlocked(entry),
          complete: this.isWorldComplete(entry.id),
          hasContent: !!world,
          total, done,
        };
      });
    },

    /* ---------------- Overworld ---------------- */
    renderOverworld() {
      PyQuest.Overworld.render(
        { canvas: $('#map-canvas'), svg: $('#map-paths'), nodes: $('#map-nodes') },
        this.worldStates(),
        (state) => this.onWorldClick(state)
      );
    },

    onWorldClick(state) {
      Audio.click();
      if (!state.unlocked) {
        const req = this.entry(state.entry.requires);
        this.flash(`Termine « ${req ? req.title : '…'} » pour débloquer ce monde.`);
        return;
      }
      if (!state.hasContent) {
        this.flash('Ce monde arrive bientôt !');
        return;
      }
      this.openWorld(state.entry.id);
    },

    /* ---------------- Panneau monde (sélection niveau) ---------------- */
    openWorld(worldId) {
      this.currentWorldId = worldId;
      const entry = this.entry(worldId);
      const world = this.worlds[worldId];
      const body = $('#world-panel-body');
      body.innerHTML = '';

      if (entry.banner) {
        body.appendChild(el('img', { class: 'panel-banner', src: entry.banner, alt: entry.title }));
      }
      body.appendChild(el('h2', { class: 'panel-title' }, entry.title));
      body.appendChild(el('p', { class: 'panel-desc' }, world.description || entry.description || ''));

      const list = el('div', { class: 'level-list' });
      world.levels.forEach((lv, i) => {
        const done = this.isLevelDone(worldId, lv.id);
        // Un niveau est ouvert si c'est le premier ou si le précédent est réussi.
        const unlocked = i === 0 || this.isLevelDone(worldId, world.levels[i - 1].id);
        const cls = 'level-item' + (done ? ' is-done' : '') + (unlocked ? '' : ' is-locked');
        const icon = done ? '✔' : unlocked ? '▶' : '🔒';

        const item = el('div', { class: cls, onClick: () => {
          if (!unlocked) { Audio.fail(); return; }
          Audio.click();
          $('#world-panel').classList.add('hidden');
          this.openLevel(worldId, i);
        } }, [
          el('div', { class: 'level-item-main' }, [
            el('div', { class: 'level-item-title' }, `${i + 1}. ${lv.title || 'Niveau'}`),
            el('div', { class: 'level-item-sub' }, done ? 'Terminé' : unlocked ? 'Disponible' : 'Verrouillé'),
          ]),
          el('div', { style: { textAlign: 'right' } }, [
            el('div', { class: 'level-item-icon' }, icon),
            el('div', { class: 'level-item-xp' }, `${lv.xp || 0} XP`),
          ]),
        ]);
        list.appendChild(item);
      });
      body.appendChild(list);

      $('#world-panel').classList.remove('hidden');
    },

    /* ---------------- Niveau ---------------- */
    openLevel(worldId, index) {
      const entry = this.entry(worldId);
      const world = this.worlds[worldId];
      const level = world.levels[index];
      showScreen('level-view');
      $('#hud').classList.remove('hidden');
      PyQuest.Level.mount({ worldEntry: entry, world, level, index, game: this });
    },

    backToWorld(worldId) {
      PyQuest.Level.disposeEditor();
      document.getElementById('fx-layer').innerHTML = '';
      this.renderOverworld();
      showScreen('overworld');
      this.openWorld(worldId);
    },

    /* ---------------- Complétion ---------------- */
    completeLevel(worldId, level) {
      const before = this.unlockedSet();
      const key = this.levelKey(worldId, level.id);
      let xpGained = 0;
      if (!this.state.completed[key]) {
        this.state.completed[key] = true;
        xpGained = level.xp || 0;
        this.state.xp = (this.state.xp || 0) + xpGained;
      }
      this.save();

      const worldCompleted = this.isWorldComplete(worldId);
      const after = this.unlockedSet();
      const newlyUnlocked = [...after]
        .filter((id) => !before.has(id))
        .map((id) => this.entry(id))
        .filter(Boolean)
        .map((e) => e.title);

      return { xpGained, worldCompleted, newlyUnlocked };
    },

    /* ---------------- Petit message flash ---------------- */
    flash(msg) {
      const fx = document.getElementById('fx-layer');
      const t = el('div', {
        style: {
          position: 'absolute', bottom: '40px', left: '50%', transform: 'translateX(-50%)',
          background: '#202234', border: '3px solid #566c86', padding: '12px 18px',
          fontSize: '9px', color: '#f4f4f4', pointerEvents: 'none', maxWidth: '80%', textAlign: 'center',
        },
      }, msg);
      fx.appendChild(t);
      setTimeout(() => t.remove(), 2200);
    },
  };

  return Game;
})();

/* ---- Démarrage ---- */
window.addEventListener('DOMContentLoaded', () => {
  // Fermer le panneau monde via le bouton ✕ ou clic sur le fond.
  const wp = document.getElementById('world-panel');
  document.getElementById('world-close').addEventListener('click', () => {
    PyQuest.Audio.click();
    wp.classList.add('hidden');
  });
  wp.addEventListener('click', (e) => { if (e.target === wp) wp.classList.add('hidden'); });

  // Échap ferme le panneau monde.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !wp.classList.contains('hidden')) {
      wp.classList.add('hidden');
      PyQuest.Audio.click();
    }
  });

  PyQuest.Game.init();
});
