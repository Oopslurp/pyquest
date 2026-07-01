/* ============================================================
   audio.js — bips rétro générés en WebAudio (aucun asset requis)
   L'AudioContext est initialisé au premier geste utilisateur.
   ============================================================ */
window.PyQuest = window.PyQuest || {};

PyQuest.Audio = (function () {
  let ctx = null;
  let muted = false;

  function ensure() {
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        ctx = null;
      }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function tone(freq, start, dur, type = 'square', vol = 0.08) {
    if (!ctx || muted) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    const t = ctx.currentTime + start;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function seq(notes) {
    ensure();
    notes.forEach((n) => tone(n.f, n.t, n.d, n.type || 'square', n.v || 0.08));
  }

  return {
    unlock() { ensure(); },
    setMuted(m) { muted = m; },
    isMuted() { return muted; },

    click()  { seq([{ f: 440, t: 0, d: 0.06 }]); },
    hover()   { seq([{ f: 660, t: 0, d: 0.03, v: 0.04 }]); },
    success() {
      seq([
        { f: 523, t: 0.00, d: 0.10 },
        { f: 659, t: 0.09, d: 0.10 },
        { f: 784, t: 0.18, d: 0.10 },
        { f: 1046, t: 0.27, d: 0.22 },
      ]);
    },
    fail() {
      seq([
        { f: 200, t: 0.00, d: 0.18, type: 'sawtooth', v: 0.07 },
        { f: 150, t: 0.14, d: 0.22, type: 'sawtooth', v: 0.07 },
      ]);
    },
    xp() { seq([{ f: 880, t: 0, d: 0.06 }, { f: 1320, t: 0.06, d: 0.08 }]); },
    worldUnlock() {
      seq([
        { f: 392, t: 0.00, d: 0.12 },
        { f: 523, t: 0.12, d: 0.12 },
        { f: 659, t: 0.24, d: 0.12 },
        { f: 784, t: 0.36, d: 0.12 },
        { f: 1046, t: 0.48, d: 0.30 },
      ]);
    },
  };
})();
