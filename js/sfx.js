/* TT Fence Builder: sound effects, all synthesised with Kit.sound.tone and Kit.sound.hiss (no audio files), so they
   follow the kit's one sound switch. Our own sounds: a wooden "tok" for every fence post (lower and slower for a slow
   build), a rising sparkle sweep when land turns into garden (bigger claims ring longer), a springy BOING when the
   fence snaps back, a squeaky ball bounce, a bug's "ah-CHOO" sneeze, an icy shimmer for the freeze. Every effect is
   silent until Kit.sound.init(). */
(function () {
  'use strict';
  const FB = (window.FB = window.FB || {});
  const S = Kit.sound;
  const { tone, hiss } = S;
  const notes = (list, o = {}) => list.forEach((f, i) => tone({ type: o.type || 'triangle', f, at: (o.at || 0) + i * (o.gap || 0.07), dur: o.dur || 0.16, vol: o.vol || 0.12 }));
  let lastBounce = 0, lastPost = 0, postN = 0;

  FB.sfx = {
    // a fence post goes in: a little wooden tok, stepping up a scale as the fence grows
    post(slow) {
      const now = performance.now();
      if (now - lastPost < 45) return;
      lastPost = now;
      const f = [523, 587, 659, 784, 880][postN++ % 5] * (slow ? 0.75 : 1);
      tone({ type: 'square', f, to: f * 0.7, dur: 0.05, vol: 0.035, lp: 1800 });
      hiss({ filter: 'bandpass', f: 1800, q: 4, dur: 0.03, vol: 0.05 });
    },
    rollback() { tone({ type: 'sine', f: 700, to: 500, dur: 0.06, vol: 0.05 }); },
    buildStart() { postN = 0; tone({ type: 'triangle', f: 440, to: 660, dur: 0.1, vol: 0.06 }); },
    // land turns into garden: a sparkle sweep, longer for a bigger claim
    claim(cells, slow) {
      const n = Math.min(7, 3 + Math.floor(cells / 60));
      const scale = [523, 659, 784, 1047, 1319, 1568, 2093];
      notes(scale.slice(0, n), { gap: 0.06, vol: 0.1, type: slow ? 'sine' : 'triangle', dur: 0.22 });
      hiss({ filter: 'highpass', f: 2500, to: 6000, dur: 0.15 + n * 0.05, vol: 0.04 });
      if (slow) notes([1568, 2093], { gap: 0.08, vol: 0.06, at: n * 0.06 + 0.05, type: 'sine' });
    },
    // the fence snapped back: a springy boing
    snap(lost) {
      tone({ type: 'sine', f: 180, to: 520, dur: 0.18, vol: 0.16 });
      tone({ type: 'sine', f: 520, to: 160, dur: 0.3, vol: 0.12, at: 0.16 });
      if (lost) tone({ type: 'triangle', f: 330, to: 220, dur: 0.35, vol: 0.08, at: 0.45 });
    },
    // a squeaky beach-ball bounce
    bounce() {
      const now = performance.now();
      if (now - lastBounce < 120) return;
      lastBounce = now;
      tone({ type: 'sine', f: 260, to: 420, dur: 0.07, vol: 0.05 });
    },
    // a bug sneezes into confetti: "ah... ah... CHOO"
    sneeze() {
      tone({ type: 'sine', f: 600, to: 700, dur: 0.12, vol: 0.05 });
      tone({ type: 'sine', f: 650, to: 800, dur: 0.12, vol: 0.05, at: 0.16 });
      hiss({ filter: 'bandpass', f: 2600, q: 0.8, dur: 0.22, vol: 0.18, at: 0.32 });
      tone({ type: 'triangle', f: 900, to: 300, dur: 0.2, vol: 0.06, at: 0.32 });
    },
    bugIn() { notes([1568, 1760], { gap: 0.05, vol: 0.03, type: 'sine', dur: 0.08 }); },
    oops() {
      tone({ type: 'sine', f: 900, to: 260, dur: 0.4, vol: 0.12 });
      tone({ type: 'triangle', f: 330, to: 300, dur: 0.3, vol: 0.06, at: 0.4 });
    },
    // the freeze: a twinkly icy shimmer
    freeze() {
      notes([2093, 2637, 3136, 2637, 3136, 3520], { gap: 0.05, vol: 0.05, type: 'sine', dur: 0.25 });
      hiss({ filter: 'highpass', f: 5000, dur: 0.5, vol: 0.05 });
    },
    thaw() { tone({ type: 'sine', f: 1200, to: 500, dur: 0.25, vol: 0.05 }); },
    level() { notes([523, 784], { gap: 0.1, vol: 0.08 }); },
    clear() { notes([523, 659, 784, 1047, 784, 1047, 1319], { gap: 0.1, dur: 0.24, vol: 0.12 }); },
    done() { notes([523, 659, 784, 1047, 1319, 1568, 2093], { gap: 0.12, dur: 0.3, vol: 0.13 }); },
    over() { notes([392, 370, 349, 330], { gap: 0.22, dur: 0.3, vol: 0.1 }); },
    highfive() {
      hiss({ f: 1800, q: 1.2, dur: 0.07, vol: 0.4 });
      hiss({ f: 2400, q: 1.2, dur: 0.05, vol: 0.2, at: 0.05 });
      notes([659, 880, 1109, 1319], { gap: 0.06, vol: 0.1, at: 0.12 });
    },
    buddyIn() { tone({ type: 'sine', f: 400, to: 1200, dur: 0.35, vol: 0.1 }); hiss({ f: 1200, to: 3000, dur: 0.35, vol: 0.05 }); },
    buddyOut() { tone({ type: 'sine', f: 1200, to: 400, dur: 0.35, vol: 0.08 }); },
    gift() { S.coin(4); notes([1047, 1319], { gap: 0.08, vol: 0.08, at: 0.15 }); },
    click() { S.click(); },
    start() { S.powerup(); },
  };
})();
