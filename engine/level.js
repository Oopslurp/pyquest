/* ============================================================
   level.js — moteur de niveau générique et réutilisable
   ------------------------------------------------------------
   Piloté entièrement par les données JSON du niveau. Rien n'est
   codé en dur ici : énoncé, code de départ, indices, tests et XP
   proviennent du monde chargé.
   ============================================================ */
window.PyQuest = window.PyQuest || {};

PyQuest.Level = (function () {
  const { el, esc, $ } = PyQuest.util;
  const Audio = PyQuest.Audio;

  let editor = null;      // instance Monaco courante
  let current = null;     // contexte du niveau monté

  function disposeEditor() {
    if (editor) { editor.dispose(); editor = null; }
  }

  /** Monte la vue niveau.
   *  ctx = { worldEntry, world, level, index, game } */
  function mount(ctx) {
    current = ctx;
    disposeEditor();

    const { worldEntry, world, level, index, game } = ctx;
    const key = game.levelKey(worldEntry.id, level.id);
    const savedCode = game.state.code[key];
    const startCode = savedCode != null ? savedCode : (level.startCode || '');
    let hintsShown = game.state.hintsSeen[key] || 0;

    const root = document.getElementById('level-view');
    root.innerHTML = '';

    // ---------- Colonne gauche : briefing ----------
    const hintsBox = el('div', { class: 'hints hidden' });
    const brief = el('div', { class: 'brief' }, [
      el('div', { class: 'brief-tag' }, `${worldEntry.title} · Niveau ${index + 1}/${world.levels.length}`),
      el('div', { class: 'brief-title' }, level.title || 'Sans titre'),
      el('div', { class: 'brief-statement', html: level.statement || '' }),
      el('div', { class: 'brief-xp' }, `Récompense : ${level.xp || 0} XP`),
      hintsBox,
    ]);

    const hints = Array.isArray(level.hints) ? level.hints : [];
    const hintBtn = el('button', { class: 'btn btn-ghost', onClick: revealHint },
      hints.length ? `💡 Indice (0/${hints.length})` : '💡 Aucun indice');
    if (!hints.length) hintBtn.disabled = true;

    function renderHints() {
      hintsBox.innerHTML = '';
      if (hintsShown <= 0) { hintsBox.classList.add('hidden'); return; }
      hintsBox.classList.remove('hidden');
      for (let i = 0; i < hintsShown && i < hints.length; i++) {
        hintsBox.appendChild(
          el('div', { class: 'hint', html: `<span class="hint-num">Indice ${i + 1} :</span> ${hints[i]}` })
        );
      }
      hintBtn.textContent = hintsShown >= hints.length
        ? `💡 Indices (${hints.length}/${hints.length})`
        : `💡 Indice (${hintsShown}/${hints.length})`;
      if (hintsShown >= hints.length) hintBtn.disabled = true;
    }
    function revealHint() {
      if (hintsShown < hints.length) {
        hintsShown++;
        game.state.hintsSeen[key] = hintsShown;
        game.save();
        renderHints();
        Audio.click();
      }
    }

    // ---------- Colonne droite : atelier ----------
    const editorHost = el('div', { class: 'editor-host' });
    const statusLine = el('div', { class: 'editor-status' }, 'Écris ton code, puis « Valider ».');
    const console_ = el('div', { class: 'console' }, [
      el('div', { class: 'console-title' }, 'CONSOLE'),
      el('pre', {}, '—'),
    ]);
    const results = el('div', { class: 'results' });

    const runBtn = el('button', { class: 'btn', onClick: () => execute() }, '▶ Exécuter');
    const valBtn = el('button', { class: 'btn btn-primary', onClick: () => validate() }, '✓ Valider');
    const resetBtn = el('button', { class: 'btn btn-ghost', onClick: () => {
      editor.setValue(level.startCode || '');
      Audio.click();
    } }, '↺ Réinitialiser');
    const backBtn = el('button', { class: 'btn btn-ghost', onClick: () => game.backToWorld(worldEntry.id) }, '← Carte');

    const workspace = el('div', { class: 'workspace' }, [
      el('div', { class: 'editor-toolbar' }, [
        backBtn, resetBtn, hintBtn,
        el('span', { class: 'spacer' }),
        runBtn, valBtn,
      ]),
      editorHost,
      statusLine,
      console_,
      results,
    ]);

    root.appendChild(el('div', { class: 'level-wrap' }, [brief, workspace]));
    renderHints();

    // ---------- Éditeur Monaco ----------
    // Police monospace fiable (jamais la police pixel) + ligatures désactivées
    // pour un positionnement de curseur exact.
    editor = monaco.editor.create(editorHost, {
      value: startCode,
      language: 'python',
      theme: 'pyquest',
      fontSize: 14,
      fontFamily: PyQuest.CODE_FONT,
      fontLigatures: false,
      minimap: { enabled: false },
      automaticLayout: true,
      scrollBeyondLastLine: false,
      tabSize: 4,
      insertSpaces: true,
      lineNumbersMinChars: 3,
      padding: { top: 10 },
    });

    // Filet de sécurité : si la police web finit de charger juste après la
    // création de l'éditeur, on force Monaco à re-mesurer les largeurs de
    // caractères puis on relaie le layout (sinon le curseur reste décalé).
    PyQuest.util.ensureFont(PyQuest.CODE_FONT_FAMILY, ['14px', '600 14px']).then(() => {
      if (!editor) return;
      try { monaco.editor.remeasureFonts(); } catch (e) { /* noop */ }
      editor.layout();
    });

    const saveCode = PyQuest.util.debounce(() => {
      game.state.code[key] = editor.getValue();
      game.save();
    }, 500);
    editor.onDidChangeModelContent(saveCode);

    // ---------- Exécution libre ----------
    async function execute() {
      Audio.click();
      setBusy(true, 'Exécution…');
      const pre = console_.querySelector('pre');
      try {
        const { stdout, error } = await PyQuest.PyRunner.runRaw(editor.getValue());
        if (error) {
          pre.className = 'err';
          pre.textContent = error;
        } else {
          pre.className = '';
          pre.textContent = stdout || '(aucune sortie)';
        }
      } catch (e) {
        pre.className = 'err';
        pre.textContent = String(e);
      } finally {
        setBusy(false, 'Exécution terminée.');
      }
    }

    // ---------- Validation par les tests ----------
    async function validate() {
      Audio.click();
      setBusy(true, 'Validation en cours…');
      results.innerHTML = '';
      const code = editor.getValue();
      game.state.code[key] = code; game.save();

      const tests = Array.isArray(level.tests) ? level.tests : [];
      const outcomes = [];
      for (const test of tests) {
        try {
          outcomes.push({ test, res: await PyQuest.PyRunner.runTest(code, test) });
        } catch (e) {
          outcomes.push({ test, res: { ok: false, error: String(e) } });
        }
      }

      // Console : montre la sortie du premier test qui en produit.
      const withOut = outcomes.find((o) => o.res.stdout);
      const pre = console_.querySelector('pre');
      pre.className = '';
      pre.textContent = withOut ? withOut.res.stdout : '(aucune sortie)';

      outcomes.forEach((o, i) => results.appendChild(renderResult(o.test, o.res, i)));

      const allOk = outcomes.length > 0 && outcomes.every((o) => o.res.ok);
      if (allOk) {
        setBusy(false, 'Bravo, tous les tests passent !');
        onSuccess();
      } else {
        setBusy(false, 'Pas encore… regarde les tests en rouge.');
        Audio.fail();
        // Révèle un indice supplémentaire à chaque échec (jusqu'au max).
        if (hintsShown < hints.length) revealHint();
      }
    }

    function renderResult(test, res, i) {
      const pass = !!res.ok;
      const label = test.description || `Test ${i + 1}`;
      const node = el('div', { class: 'result ' + (pass ? 'pass' : 'fail') }, [
        el('span', { class: 'result-icon' }, pass ? '✔' : '✘'),
        el('span', {}, label),
      ]);
      if (!pass) {
        let detailHtml;
        if (res.error) {
          detailHtml = `<b>Erreur :</b><br><code>${esc(res.error)}</code>`;
        } else {
          detailHtml =
            `<b>Attendu :</b> <code>${esc(fmt(res.expected))}</code><br>` +
            `<b>Obtenu&nbsp;:</b> <code>${esc(fmt(res.got))}</code>`;
        }
        node.appendChild(el('div', { class: 'result-detail', html: detailHtml }));
      }
      return node;
    }

    function fmt(v) {
      if (v === null || v === undefined) return '(rien)';
      if (typeof v === 'string') return JSON.stringify(v);
      return JSON.stringify(v);
    }

    function setBusy(busy, msg) {
      runBtn.disabled = busy;
      valBtn.disabled = busy;
      if (msg) statusLine.textContent = msg;
    }

    // ---------- Succès ----------
    function onSuccess() {
      const info = game.completeLevel(worldEntry.id, level);
      game.updateHUD();
      if (info.xpGained > 0) Audio.success(); else Audio.click();
      PyQuest.Level.successFx(info, ctx);
    }
  }

  /* ---------- Animation de succès (couche fx) ---------- */
  function successFx(info, ctx) {
    const { world, index, worldEntry, game } = ctx;
    const fx = document.getElementById('fx-layer');
    fx.innerHTML = '';

    const dim = el('div', { class: 'fx-dim' });
    const hasNext = index + 1 < world.levels.length;

    const actions = el('div', { class: 'actions' });
    if (hasNext) {
      actions.appendChild(el('button', { class: 'btn btn-primary', onClick: () => {
        clearFx(); game.openLevel(worldEntry.id, index + 1);
      } }, '▶ Niveau suivant'));
    }
    actions.appendChild(el('button', { class: 'btn', onClick: () => {
      clearFx(); game.backToWorld(worldEntry.id);
    } }, '🗺 Carte'));

    const banner = el('div', { class: 'success-banner' }, [
      el('div', { class: 'big' }, 'NIVEAU RÉUSSI !'),
      info.xpGained > 0 ? el('div', { class: 'xp-pop' }, `+${info.xpGained} XP`) : null,
      info.worldCompleted ? el('div', { class: 'unlock' }, `★ Monde terminé : ${worldEntry.title} ★`) : null,
      info.newlyUnlocked && info.newlyUnlocked.length
        ? el('div', { class: 'unlock' }, `Nouveau monde débloqué : ${info.newlyUnlocked.join(', ')}`)
        : null,
      actions,
    ]);

    fx.appendChild(dim);
    fx.appendChild(banner);
    confetti(fx);
    if (info.newlyUnlocked && info.newlyUnlocked.length) {
      setTimeout(() => PyQuest.Audio.worldUnlock(), 500);
    }

    function clearFx() { fx.innerHTML = ''; }
  }

  function confetti(fx) {
    const cols = PyQuest.Palette.colors;
    for (let i = 0; i < 60; i++) {
      const c = el('div', { class: 'confetti' });
      c.style.left = Math.random() * 100 + '%';
      c.style.background = cols[Math.floor(Math.random() * cols.length)];
      c.style.animationDuration = 1.5 + Math.random() * 1.8 + 's';
      c.style.animationDelay = Math.random() * 0.6 + 's';
      fx.appendChild(c);
      setTimeout(() => c.remove(), 4000);
    }
  }

  return { mount, successFx, disposeEditor };
})();
