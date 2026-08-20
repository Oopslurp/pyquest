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
      // Le PNJ du monde (champ `npc` du manifest) : l'écran de niveau était
      // strictement identique dans tous les mondes.
      el('div', { class: 'brief-head' }, [
        worldEntry.npc ? el('img', { class: 'brief-npc', src: worldEntry.npc, alt: '' }) : null,
        el('div', { class: 'brief-head-text' }, [
          el('div', { class: 'brief-tag' }, `${worldEntry.title} · Niveau ${index + 1}/${world.levels.length}`),
          el('div', { class: 'brief-title' }, level.title || 'Sans titre'),
        ]),
      ]),
      el('div', { class: 'brief-statement', html: level.statement || '' }),
      el('div', { class: 'brief-xp' }, `Récompense : ${level.xp || 0} XP`),
      hintsBox,
    ]);

    const hints = Array.isArray(level.hints) ? level.hints : [];
    // () => revealHint() : ne PAS passer l'événement (il vaudrait `auto`).
    const hintBtn = el('button', { class: 'btn btn-ghost', onClick: () => revealHint() },
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

    // ---------- Colonne droite : atelier ----------
    const editorHost = el('div', { class: 'editor-host' });
    const statusLine = el('div', { class: 'editor-status' },
      'Ctrl+Entrée : valider · Alt+Entrée : exécuter');
    const stdinArea = el('textarea', {
      class: 'stdin-input', rows: '3',
      placeholder: "Une ligne par appel à input()\nex :\n7",
    });
    const stdinBox = el('details', { class: 'stdin-box' }, [
      el('summary', {}, '⌨ Entrées pour input() (mode Exécuter)'),
      stdinArea,
    ]);
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
      stdinBox,
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

    // Raccourcis : Ctrl+Entrée = Valider, Alt+Entrée = Exécuter.
    // (execute/validate sont hoistées : déclarées plus bas dans mount().)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => validate());
    editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.Enter, () => execute());

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
      const clearHint = () => {
        const old = console_.querySelector('.err-hint');
        if (old) old.remove();
      };
      try {
        const { stdout, error } = await PyQuest.PyRunner.runRaw(editor.getValue(), stdinArea.value);
        if (error) {
          pre.className = 'err';
          pre.textContent = error;
          clearHint();
          const h = PyQuest.ErrHints.explain(error);
          if (h) console_.appendChild(el('div', { class: 'err-hint', html: `💡 <b>${h.type}</b> — ${esc(h.advice)}` }));
        } else {
          pre.className = '';
          pre.textContent = stdout || '(aucune sortie)';
          clearHint();
        }
      } catch (e) {
        pre.className = 'err';
        pre.textContent = e.message || String(e);
        clearHint();
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
          outcomes.push({ test, res: { ok: false, error: e.message || String(e) } });
          if (e.isTimeout) {
            // Ne pas attendre la relance du moteur pour chaque test restant :
            // on marque les suivants comme non exécutés et on s'arrête.
            tests.slice(outcomes.length).forEach((t2) => {
              outcomes.push({ test: t2, res: { ok: false, error: 'Non exécuté (délai dépassé au test précédent).' } });
            });
            break;
          }
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
        const tries = (game.state.attempts[key] = (game.state.attempts[key] || 0) + 1);
        game.save();
        setBusy(false, tries >= 2
          ? 'Pas encore… pense au bouton 💡 Indice.'
          : 'Pas encore… regarde les tests en rouge.');
        Audio.fail();
        // Secousse : l'échec n'avait aucun retour visuel, seulement du texte gris.
        results.classList.remove('shake');
        void results.offsetWidth;   // force le navigateur à rejouer l'animation
        results.classList.add('shake');
        // Seul le PREMIER indice se révèle automatiquement, au 2e échec.
        if (tries === 2 && hintsShown === 0 && hints.length > 0) revealHint(true);
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
          const h = PyQuest.ErrHints.explain(res.error);
          if (h) detailHtml += `<div class="err-hint">💡 <b>${h.type}</b> — ${esc(h.advice)}</div>`;
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
      if (info.xpGained > 0) {
        Audio.success();
        game.floatXP(info.xpGained);
        setTimeout(() => Audio.xp(), 560);
      } else {
        Audio.click();
      }
      PyQuest.Level.successFx(info, ctx);
    }
  }

  /* ---------- Animation de succès (couche fx) ---------- */
  function successFx(info, ctx) {
    const { world, index, worldEntry, game } = ctx;
    const fx = document.getElementById('fx-layer');
    fx.innerHTML = '';

    // Dernier niveau du dernier monde : le jeu se terminait sur la même
    // bannière que les six mondes précédents.
    if (info.gameCompleted) { finalFx(ctx); return; }

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
      info.levelUp ? el('div', { class: 'levelup' }, `⬆ NIVEAU ${info.levelUp} ATTEINT`) : null,
      info.worldCompleted ? el('div', { class: 'unlock' }, `★ Monde terminé : ${worldEntry.title} ★`) : null,
      info.newlyUnlocked && info.newlyUnlocked.length
        ? el('div', { class: 'unlock' }, `Nouveau monde débloqué : ${info.newlyUnlocked.join(', ')}`)
        : null,
      actions,
    ]);

    fx.appendChild(dim);
    fx.appendChild(banner);
    confetti(fx);
    if (info.levelUp) setTimeout(() => PyQuest.Audio.xp(), 900);
    if (info.newlyUnlocked && info.newlyUnlocked.length) {
      // 900 ms et non 500 : la fanfare de succès dure ~490 ms, les deux
      // jingles se chevauchaient.
      setTimeout(() => PyQuest.Audio.worldUnlock(), 1200);
    }

    function clearFx() { fx.innerHTML = ''; }
  }

  /* ---------- Écran de fin de jeu ---------- */
  function finalFx(ctx) {
    const { worldEntry, game } = ctx;
    const fx = document.getElementById('fx-layer');
    const t = game.gameTotals();
    const xp = game.state.xp || 0;

    const banner = el('div', { class: 'success-banner final-banner' }, [
      el('div', { class: 'crown' }, '★'),
      el('div', { class: 'big' }, 'AVENTURE TERMINÉE'),
      el('div', { class: 'xp-pop' }, `${t.done} / ${t.total} niveaux`),
      el('div', { class: 'unlock' },
        `${xp} XP sur ${t.xpMax} · Niveau ${game.playerLevel(xp)}`),
      el('div', { class: 'unlock' },
        'Tous les mondes sont à toi — des variables du Village aux simulations de la Taverne.'),
      el('div', { class: 'actions' }, [
        el('button', { class: 'btn btn-primary', onClick: () => {
          fx.innerHTML = ''; game.backToWorld(worldEntry.id);
        } }, '🗺 Retour à la carte'),
      ]),
    ]);

    fx.appendChild(el('div', { class: 'fx-dim' }));
    fx.appendChild(banner);
    confetti(fx, 160);
    PyQuest.Audio.worldUnlock();
    setTimeout(() => PyQuest.Audio.worldUnlock(), 800);
  }

  function confetti(fx, nombre) {
    // On écarte les deux couleurs les plus sombres : invisibles sur le fond nuit.
    const sombres = [PyQuest.Palette.named.night, PyQuest.Palette.named.deep];
    const cols = PyQuest.Palette.colors.filter((c) => sombres.indexOf(c) === -1);
    for (let i = 0; i < (nombre || 60); i++) {
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
