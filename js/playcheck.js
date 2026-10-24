/* TT Fence Builder: the play check. Drives the page the way a kid does: real keydown / keyup events on window and
   pointer events on the touch pad and buttons (never the rules' inputs or the autopilot), lets the game run through its
   own runner (game.step), and measures where each builder really is on the screen (projected through the camera).
   - direction: → / D move right on screen, ← / A left, ↑ / W (holding BUILD) up into the field, ↓ / S back down
     (rolling the fence back up), on all 5 pictures; 1P as Teddy and as Tommy; in 2P each set moves only its own brother
   - build: holding Space and ↑ builds a fence across the field and closes it: the side without the ball turns into
     garden; holding Shift builds slowly (double points); a tap shorter than a frame still takes one step
   - touch: the pad moves the builder the way it's pushed, BUILD lets him step out; in 2P the right pad is Tommy's
   - stuck: nothing leaves the builder stuck: a snapped fence (EASY and NORMAL), a bug's sneeze, the brother and his
     freeze, the frozen ball in the way, pause with a key held, the ? panel, a lost window focus, a cancelled finger,
     keep going after running out of lives, the next picture, a fence curled up on itself, and in 2P
   game.playCheck() runs it; game.playProve() runs it with the keys mirrored and with a stun that never ends, and
   passes only if both are caught. */
(function () {
  'use strict';
  const FB = window.FB;
  const NAMES = { ArrowRight: 'ArrowRight', ArrowLeft: 'ArrowLeft', ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', KeyA: 'a', KeyD: 'd', KeyW: 'w', KeyS: 's',
    KeyT: 't', KeyP: 'p', Space: ' ', Enter: 'Enter', Escape: 'Escape', ShiftLeft: 'Shift', Slash: '/' };
  const key = (type, code) => window.dispatchEvent(new KeyboardEvent(type, { code, key: NAMES[code] || code, bubbles: true, cancelable: true }));
  const down = (code) => key('keydown', code);
  const up = (code) => key('keyup', code);
  const run = (s) => window.game.step(s, { draw: false });
  const ptr = (el, type, x, y, id = 7) => el.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, pointerId: id, pointerType: 'touch', isPrimary: true, bubbles: true, cancelable: true }));
  const $ = (id) => document.getElementById(id);

  function screenAt(id) {
    const g = window.game;
    g.view.shake = 0;
    g.view.update(g.sim, 0);
    return g.view.project(g.view.kidObj(id));
  }
  // hold some keys for a while; which way did the builder go on the screen?
  function hold(codes, id, secs = 0.3) {
    const a = screenAt(id);
    for (const c of codes) down(c);
    run(secs);
    for (const c of codes.slice().reverse()) up(c);
    run(0.2);
    const b = screenAt(id);
    return { dx: b.x - a.x, dy: b.y - a.y };
  }
  function place(id, i, j) {
    const p = window.game.sim.player(id);
    Object.assign(p, { i, j, ti: -1, tj: -1, prog: 0, mode: 'walk', path: [], kind: '', oopsT: 0, inv: 0 });
  }
  // keep the ball and the bugs out of the way while measuring
  function quiet() {
    const s = window.game.sim;
    Object.assign(s.ball, { x: 30.5, y: 6.5, waitT: 1e9, frozenT: 0 });
    for (const b of s.bugs) b.goneT = 1e9;
  }

  function playCheck(o = {}) {
    const g = window.game;
    const lines = [], fails = [];
    const check = (name, ok, info) => { lines.push(`${ok ? '✓' : '✗'} ${name}${info ? ': ' + info : ''}`); if (!ok) fails.push(name); };
    g.keepAwake();
    g.autoPause(false);
    g.sabotage(o.sabotage || null);
    const wasEasy = g.G.easy;
    const four = (id, keys, bad, tag) => {
      // keys: [right, left, up, down, build]
      const [R, L, U, D, B] = keys;
      const r = hold([R], id), l = hold([L], id), u = hold([B, U], id), d = hold([D], id, 0.25);
      if (!(r.dx > 15 && Math.abs(r.dy) < Math.abs(r.dx))) bad.push(`${tag} ${R}: ${r.dx.toFixed(0)}, ${r.dy.toFixed(0)} px`);
      if (!(l.dx < -15 && Math.abs(l.dy) < Math.abs(l.dx))) bad.push(`${tag} ${L}: ${l.dx.toFixed(0)}, ${l.dy.toFixed(0)} px`);
      if (!(u.dy < -10 && Math.abs(u.dx) < Math.abs(u.dy))) bad.push(`${tag} ${B}+${U}: ${u.dx.toFixed(0)}, ${u.dy.toFixed(0)} px`);
      if (!(d.dy > 10 && Math.abs(d.dx) < Math.abs(d.dy))) bad.push(`${tag} ${D}: ${d.dx.toFixed(0)}, ${d.dy.toFixed(0)} px`);
    };
    try {
      // ---------------------------------------------------------------- direction, every picture
      for (const [mode, hero] of [['1p', 'teddy'], ['1p', 'tommy'], ['2p', 'teddy']]) {
        const bad = [];
        for (let lv = 1; lv <= FB.LEVELS.length; lv++) {
          g.start(lv, mode, hero, lv % 2 === 1);
          quiet();
          run(0.1);
          if (mode === '2p') {
            place('teddy', 12, FB.GH - 1);
            place('tommy', 28, FB.GH - 1);
            const m0 = screenAt('tommy');
            four('teddy', ['KeyD', 'KeyA', 'KeyW', 'KeyS', 'Space'], bad, `picture ${lv} Teddy`);
            const m1 = screenAt('tommy');
            if (Math.hypot(m1.x - m0.x, m1.y - m0.y) > 1) bad.push(`picture ${lv}: Teddy's keys moved Tommy`);
            const t0 = screenAt('teddy');
            four('tommy', ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'Enter'], bad, `picture ${lv} Tommy`);
            const t1 = screenAt('teddy');
            if (Math.hypot(t1.x - t0.x, t1.y - t0.y) > 1) bad.push(`picture ${lv}: Tommy's keys moved Teddy`);
          } else {
            place(hero, 20, FB.GH - 1);
            four(hero, ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'Space'], bad, `picture ${lv}`);
            place(hero, 20, FB.GH - 1);
            four(hero, ['KeyD', 'KeyA', 'KeyW', 'KeyS', 'Space'], bad, `picture ${lv}`);
          }
        }
        check(`direction ${mode === '2p' ? '2P' : '1P ' + hero}`, !bad.length, bad.length ? bad.slice(0, 4).join('; ') : `${mode === '1p' ? '→/D right, ←/A left, Space+↑/W up into the field, ↓/S back down' : "Teddy's WASD + Space and Tommy's arrows + Enter (each only his own builder)"}, on screen, on all ${FB.LEVELS.length} pictures`);
      }

      // ---------------------------------------------------------------- build and claim with real keys
      {
        const bad = [];
        g.start(1, '1p', 'teddy', true);
        quiet();
        run(0.1);
        place('teddy', 10, FB.GH - 1);
        const p = g.sim.player('teddy');
        down('Space'); down('ArrowUp'); run(4.5); up('ArrowUp'); up('Space'); run(0.1);
        const pct = g.sim.pct();
        if (Math.abs(pct - 260 / 988) > 1e-9 || p.mode !== 'walk' || p.j !== 0) bad.push(`Space+↑ across the field: ${(pct * 100).toFixed(1)} % (want 26.3), builder ${p.mode} at ${p.i},${p.j}`);
        const shown = $('pctNum').textContent;
        if (!/^26%/.test(shown)) bad.push(`the HUD shows ${shown}`);
        // slow: Shift alone builds, at half speed, double points
        place('teddy', 30, FB.GH - 1);
        Object.assign(g.sim.ball, { x: 20.5, y: 8.5 });
        const s0 = g.sim.score;
        const a = screenAt('teddy');
        down('ShiftLeft'); down('ArrowUp'); run(0.5);
        const b = screenAt('teddy');
        run(0.5); up('ArrowUp'); down('ArrowRight'); run(0.9); up('ArrowRight'); down('ArrowDown'); run(2); up('ArrowDown'); up('ShiftLeft'); run(0.1);
        const slowPx = a.y - b.y;
        const gain = g.sim.score - s0;
        if (p.mode !== 'walk' || gain <= 0 || gain % 20) bad.push(`slow box: ${p.mode}, scored ${gain} (want a double-points claim)`);
        // compare with a normal-speed half second
        place('teddy', 20, FB.GH - 1);
        const c = screenAt('teddy');
        down('Space'); down('ArrowUp'); run(0.5);
        const d = screenAt('teddy');
        up('ArrowUp'); up('Space');
        const fastPx = c.y - d.y;
        if (!(slowPx > 5 && fastPx > slowPx * 1.5)) bad.push(`slow build moved ${slowPx.toFixed(0)} px in 0.5 s, normal ${fastPx.toFixed(0)} px`);
        // a tap shorter than a frame still takes a step
        g.start(1, '1p', 'teddy', true);
        quiet();
        place('teddy', 20, FB.GH - 1);
        down('ArrowRight'); up('ArrowRight'); run(0.3);
        if (g.sim.player('teddy').i !== 21) bad.push(`a quick tap of → went to ${g.sim.player('teddy').i} (want 21)`);
        check('build', !bad.length, bad.length ? bad.join('; ') : `Space+↑ built across the field and closed it: 26% garden (HUD "${shown}"); Shift built at ${(slowPx / fastPx * 100).toFixed(0)}% speed for double points (+${gain}); a quick tap took one step`);
      }

      // ---------------------------------------------------------------- touch
      {
        const bad = [];
        g.showTouch(true);
        for (const [mode, n, id] of [['1p', 0, 'teddy'], ['1p', 0, 'tommy'], ['2p', 1, 'tommy']]) {
          g.start(2, mode, id, true);
          quiet();
          run(0.1);
          place(id, 20, FB.GH - 1);
          if (mode === '2p') place('teddy', 8, FB.GH - 1);
          const pad = $('pad' + n), build = $('build' + n);
          const r = pad.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
          const push = (dx, dy, secs, withBuild) => {
            const a = screenAt(id);
            if (withBuild) ptr(build, 'pointerdown', 0, 0, 21);
            ptr(pad, 'pointerdown', cx + dx, cy + dy, 22);
            run(secs);
            ptr(pad, 'pointerup', cx + dx, cy + dy, 22);
            if (withBuild) ptr(build, 'pointerup', 0, 0, 21);
            run(0.2);
            const b = screenAt(id);
            return { dx: b.x - a.x, dy: b.y - a.y };
          };
          const t0 = mode === '2p' && screenAt('teddy');
          const R = push(50, 0, 0.3), L = push(-50, 0, 0.3), U = push(0, -50, 0.3, true), D = push(0, 50, 0.25);
          const tag = `${mode} ${id}`;
          if (!(R.dx > 15)) bad.push(`${tag} pad right: ${R.dx.toFixed(0)} px`);
          if (!(L.dx < -15)) bad.push(`${tag} pad left: ${L.dx.toFixed(0)} px`);
          if (!(U.dy < -10)) bad.push(`${tag} BUILD + pad up: ${U.dy.toFixed(0)} px`);
          if (!(D.dy > 10)) bad.push(`${tag} pad down: ${D.dy.toFixed(0)} px`);
          if (t0) { const t1 = screenAt('teddy'); if (Math.hypot(t1.x - t0.x, t1.y - t0.y) > 1) bad.push("Tommy's pad moved Teddy"); }
          // the pad alone (no BUILD) doesn't step out into the field
          const N = push(0, -50, 0.3);
          if (Math.abs(N.dy) > 3) bad.push(`${tag} pad up without BUILD moved ${N.dy.toFixed(0)} px`);
        }
        g.showTouch(false);
        check('touch', !bad.length, bad.length ? bad.slice(0, 4).join('; ') : 'the pad moves the builder the way it is pushed (1P Teddy, 1P Tommy, 2P Tommy on the right pad, Teddy stays put); BUILD + up steps out; up without BUILD stays on the edge');
      }

      // ---------------------------------------------------------------- stuck
      {
        const bad = [];
        const moves = (label, id = 'teddy') => {
          const p = g.sim.player(id);
          // walk along whichever edge he's on: try →, then ←, then ↑ / ↓ (all with BUILD); in 2P Teddy uses WASD + Space
          const wasd = g.G.mode === '2p' && id === 'teddy';
          const sets = wasd ? [['KeyD'], ['KeyA'], ['Space', 'KeyW'], ['Space', 'KeyS']] : g.G.mode === '2p' ? [['ArrowRight'], ['ArrowLeft'], ['Enter', 'ArrowUp'], ['Enter', 'ArrowDown']] : [['ArrowRight'], ['ArrowLeft'], ['Space', 'ArrowUp'], ['Space', 'ArrowDown']];
          for (const set of sets) {
            const a = screenAt(id), i0 = p.i, j0 = p.j;
            for (const c of set) down(c);
            run(0.35);
            for (const c of set.slice().reverse()) up(c);
            run(0.15);
            const b = screenAt(id);
            if (Math.hypot(b.x - a.x, b.y - a.y) > 12 && (p.i !== i0 || p.j !== j0 || p.mode === 'build')) {
              if (p.mode === 'build') { down('ArrowDown'); down('ArrowLeft'); run(0.1); up('ArrowLeft'); up('ArrowDown'); }
              return;
            }
          }
          bad.push(`${label}: no key moved ${id} (at ${p.i},${p.j} ${p.mode}${p.oopsT > 0 ? ', stunned ' + p.oopsT.toFixed(1) + ' s' : ''})`);
        };
        const fence = (id, n = 6) => { down('Space'); down('ArrowUp'); run(n / 6); up('ArrowUp'); up('Space'); run(0.02); };
        const roll = (id) => { const p = g.sim.player(id); Object.assign(g.sim.ball, { x: p.i + 3.5, y: p.j + 0.5, vx: -g.sim.ball.speed, vy: 0, waitT: 0, frozenT: 0 }); };
        // EASY: the fence snaps back
        g.start(3, '1p', 'teddy', true);
        quiet();
        place('teddy', 20, FB.GH - 1);
        fence('teddy');
        roll('teddy');
        run(1.0);
        if (g.sim.player('teddy').mode !== 'walk') bad.push('EASY: the ball did not snap the fence');
        quiet();
        moves('after the fence snapped back (EASY)');
        // NORMAL: the fence snaps back and costs a life (a short "oops")
        g.start(3, '1p', 'teddy', false);
        quiet();
        place('teddy', 20, FB.GH - 1);
        fence('teddy');
        roll('teddy');
        run(1.0);
        quiet();
        if (g.sim.lives !== 2) bad.push(`NORMAL snap: lives ${g.sim.lives}`);
        moves('after the fence snapped back (NORMAL)');
        // a bug sneezes on him
        run(2.3);
        const bug = g.sim.bugs[0], p = g.sim.player('teddy');
        Object.assign(bug, { goneT: 0, i: p.i, j: p.j, ti: -1, tj: -1, prog: 0 });
        run(0.1);
        if (!(p.oopsT > 0) && g.sim.lives !== 1) bad.push('the test bug did not bump him');
        for (const b of g.sim.bugs) b.goneT = 1e9;
        run(0.9);
        moves('after a bug sneezed on him');
        // the brother and his freeze
        g.start(2, '1p', 'tommy', true);
        quiet();
        place('tommy', 20, FB.GH - 1);
        down('KeyT'); up('KeyT'); run(0.2);
        if (!g.sim.buddy) bad.push('T did not call the brother');
        moves('while the brother is here', 'tommy');
        run(2.2);
        if (!(g.sim.ball.frozenT > 0)) bad.push('the brother did not freeze the ball');
        moves('while the ball is frozen', 'tommy');
        // the frozen ball right in front of him: blocked that way, free the others
        const q = g.sim.player('tommy');
        place('tommy', 20, FB.GH - 1);
        Object.assign(g.sim.ball, { x: 20.5, y: FB.GH - 2 + 0.5, frozenT: 3, waitT: 0 });
        const blocked = hold(['Space', 'ArrowUp'], 'tommy', 0.3);
        if (Math.abs(blocked.dy) > 3 || q.mode !== 'walk') bad.push('he walked into the frozen ball');
        moves('next to the frozen ball', 'tommy');
        quiet();
        // pause with a key held: let go while paused, resume: no drifting
        g.start(1, '1p', 'teddy', true);
        quiet();
        place('teddy', 20, FB.GH - 1);
        down('ArrowRight'); run(0.1); down('KeyP'); up('KeyP');
        if (g.G.screen !== 'pause') bad.push('P did not pause');
        up('ArrowRight'); down('KeyP'); up('KeyP');
        run(0.2);
        const xp = screenAt('teddy'); run(0.5);
        if (Math.abs(screenAt('teddy').x - xp.x) > 0.5) bad.push('after pause he kept walking on his own');
        moves('after pause');
        Kit.help.open(); Kit.help.close(); run(0.05);
        moves('after the ? panel');
        // losing the window focus with a key held
        down('ArrowLeft'); run(0.1); window.dispatchEvent(new Event('blur'));
        run(0.2);
        const xb = screenAt('teddy'); run(0.5);
        if (Math.abs(screenAt('teddy').x - xb.x) > 0.5) bad.push('after the window lost focus he kept walking');
        up('ArrowLeft');
        moves('after losing focus');
        // a finger on the pad that gets cancelled
        g.showTouch(true);
        const pad = $('pad0'), r = pad.getBoundingClientRect();
        ptr(pad, 'pointerdown', r.left + r.width - 10, r.top + r.height / 2, 31); run(0.1);
        ptr(pad, 'pointercancel', r.left + r.width - 10, r.top + r.height / 2, 31);
        run(0.2);
        const xc = screenAt('teddy'); run(0.5);
        if (Math.abs(screenAt('teddy').x - xc.x) > 0.5) bad.push('a cancelled finger kept him walking');
        g.showTouch(false);
        moves('after a cancelled finger');
        // a fence curled up on itself: walk back along it to roll it up
        place('teddy', 10, FB.GH - 1);
        // one tap is one step (Space held for the first, to step off the garden)
        const taps = (codes, space) => { codes.forEach((c, k) => { if (space && k === 0) down('Space'); down(c); run(0.02); up(c); if (space && k === 0) up('Space'); run(0.22); }); };
        taps(['ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowUp'], true);
        const tp = g.sim.player('teddy');
        if (tp.i !== 11 || tp.j !== FB.GH - 5 || tp.mode !== 'build') bad.push(`curled fence: at ${tp.i},${tp.j} ${tp.mode}`);
        taps(['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowUp', 'ArrowLeft', 'ArrowLeft', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown']);
        run(0.1);
        if (tp.mode !== 'walk') bad.push(`could not roll a curled fence back up (${tp.i},${tp.j} ${tp.mode}, fence ${tp.path.length - 1})`);
        moves('after rolling a curled fence back up');
        // NORMAL: out of lives, then keep going
        g.start(2, '1p', 'teddy', false);
        quiet();
        place('teddy', 20, FB.GH - 1);
        g.sim.lives = 1;
        fence('teddy');
        roll('teddy');
        run(1.2);
        if (g.G.screen !== 'over') bad.push(`out of lives did not show the keep-going card (${g.G.screen})`);
        down('Enter'); up('Enter'); run(0.1);
        if (g.G.screen !== 'play') bad.push('Enter did not keep going');
        quiet();
        moves('after keep going');
        // the next picture
        g.sim.claimed = g.sim.border + Math.ceil(g.sim.interior * g.sim.target) - 1;
        place('teddy', 20, FB.GH - 1);
        quiet();
        fence('teddy', 30);
        run(FB.CLEAR_T + 0.3);
        if (g.sim.level !== 2 || g.sim.state !== 'play') bad.push(`the next picture did not start (picture ${g.sim.level + 1}, ${g.sim.state})`);
        quiet();
        moves('on the next picture');
        // 2P: Tommy's fence snaps; both can still move
        g.start(4, '2p', 'teddy', false);
        quiet();
        place('teddy', 10, FB.GH - 1);
        place('tommy', 28, FB.GH - 1);
        down('Enter'); down('ArrowUp'); run(1); up('ArrowUp'); up('Enter');
        roll('tommy');
        run(1.0);
        quiet();
        moves('2P Teddy while Tommy snapped');
        moves('2P Tommy after his fence snapped', 'tommy');
        down('KeyT'); up('KeyT'); run(0.3);
        moves('2P after the high five');
        check('not stuck', !bad.length, bad.length ? bad.slice(0, 4).join('; ') : 'moves after a snapped fence (EASY, NORMAL), a bug\'s sneeze, the brother and his freeze, next to the frozen ball, pause with a key held, the ? panel, lost focus, a cancelled finger, a curled-up fence, keep going, the next picture, and in 2P');
      }
    } catch (e) {
      check('play check ran', false, String((e && e.stack) || e));
    } finally {
      for (const code of Object.keys(NAMES)) up(code);
      g.sabotage(null);
      g.showTouch(false);
      g.G.easy = wasEasy;
      g.autoPause(true);
      g.title();
    }
    return { ok: !fails.length, lines, fails };
  }

  // the play check with the keys mirrored and with a stun that never ends: each must be caught
  function playProve() {
    const lines = [];
    let ok = true;
    for (const [sab, want] of [['mirror', 'direction'], ['stuckOops', 'not stuck']]) {
      const r = playCheck({ sabotage: sab });
      const caught = r.fails.some((f) => f.startsWith(want));
      ok = ok && caught;
      lines.push(`${caught ? '✓ caught' : '✗ NOT CAUGHT'}: "${sab}" → ${r.lines.filter((l) => l.startsWith('✗')).map((l) => l.slice(2, 170)).join(' | ') || 'everything passed'}`);
    }
    return { ok, lines };
  }

  window.game.playCheck = playCheck;
  window.game.playProve = playProve;
})();
