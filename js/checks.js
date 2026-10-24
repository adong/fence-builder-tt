/* TT Fence Builder: the headless checks of the rules (js/sim.js), run by `node tools/check.js` and game.check().
   FB.checks.run({ quick }) runs them all; FB.checks.prove() is the fail variant: each check runs again against a sim
   with its rule broken on purpose (o.sabotage), and passes only if every one of those runs fails.
   - claim:   a closed fence claims the side without the ball (both ways round), and a little box claims just its inside
   - percent: the percentage is claimed cells (not counting the starting edge) over the open field, exactly
   - ball:    the ball only ever bounces inside the open field (every step of long autopilot games)
   - snap:    a fence the ball touches snaps back to where it started (free on EASY, a life on NORMAL)
   - level:   a level ends on the very fence that reaches its target (EASY 60 %, NORMAL 75 %), then the next starts;
              after the last picture the game is done
   - stuck:   the builder can never get stuck: a fence curled up on itself rolls back, a builder left inside new garden
              steps to the edge, random key mashing always leaves a way to move, the autopilot finishes every level
   - freeze:  the brother freezes the ball for 5 seconds (and the 2P high five for 3)
   - frames:  the same keys give the same game at 30, 60, 120 frames a second and at a jumpy frame rate */
(function (root) {
  'use strict';
  const FB = root.FB;
  const { GW, GH, DIRS, DT, BALL_R } = FB;

  const mk = (o = {}) => new FB.Sim(Object.assign({ seed: 1, easy: true, mode: '1p', hero: 'teddy' }, o));
  const dirTo = (a, b) => { for (let d = 0; d < 4; d++) if (a[0] + DIRS[d][0] === b[0] && a[1] + DIRS[d][1] === b[1]) return d; return -1; };
  const line = (from, dir, n) => { const out = []; let c = from; for (let k = 0; k < n; k++) { c = [c[0] + DIRS[dir][0], c[1] + DIRS[dir][1]]; out.push(c); } return out; };
  const path = (from, ...legs) => { const out = []; let c = from; for (const [d, n] of legs) { const l = line(c, d, n); out.push(...l); c = l[l.length - 1]; } return out; };
  function parkBall(s, x, y) { Object.assign(s.ball, { x, y, waitT: 1e9, frozenT: 0 }); }
  function put(p, i, j) { Object.assign(p, { i, j, ti: -1, tj: -1, prog: 0, mode: 'walk', path: [], kind: '' }); }

  // follow a list of cells, the way a kid holds the keys (the next turn is held before he gets there)
  function follower(p, cells, o = {}) {
    const plan = cells.slice();
    return () => {
      const at = p.ti >= 0 ? [p.ti, p.tj] : [p.i, p.j];
      while (plan.length && plan[0][0] === at[0] && plan[0][1] === at[1]) plan.shift();
      if (!plan.length) return {};
      return { dir: dirTo(at, plan[0]), build: o.build !== false, slow: !!o.slow };
    };
  }
  // step the sim with these inputs until done() (or the time runs out); returns the events
  function run(s, fns, secs, done) {
    const evs = [];
    for (let t = 0; t < secs; t += DT) {
      const inp = {};
      for (const id in fns) inp[id] = fns[id]();
      s.step(DT, inp);
      evs.push(...s.events);
      s.events.length = 0;
      if (done && done(evs)) break;
    }
    return evs;
  }
  const drive = (s, p, cells, o = {}) => run(s, { [p.id]: follower(p, cells, o) }, o.secs || 30, () => p.ti < 0 && p.i === cells[cells.length - 1][0] && p.j === cells[cells.length - 1][1]);
  const count = (s, f) => { let n = 0; for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) if (f(i, j)) n++; return n; };
  const claimed = (s, i, j) => s.cl[j * GW + i] === 1;
  // the check's own overlap test (not the sim's, so a sabotaged sim can't fool it)
  function overlapsLand(s, x, y) {
    for (let j = Math.floor(y - BALL_R); j <= Math.floor(y + BALL_R); j++)
      for (let i = Math.floor(x - BALL_R); i <= Math.floor(x + BALL_R); i++)
        if ((!FB.inb(i, j) || claimed(s, i, j)) && FB.circleCell(x, y, BALL_R, i, j)) return true;
    return false;
  }

  // ---------------------------------------------------------------- the checks (sab: the broken rule, for prove())
  const CHECKS = {
    claim(sab) {
      const bad = [];
      for (const [bx, keepLeft] of [[30.5, false], [5.5, true]]) {
        const s = mk({ sabotage: sab }), p = s.players[0];
        parkBall(s, bx, 14.5);
        put(p, 10, GH - 1);
        const ev = drive(s, p, line([10, GH - 1], 0, GH - 1));
        if (!ev.some((e) => e.type === 'claim')) { bad.push('the fence did not close'); continue; }
        const left = count(s, (i, j) => i >= 1 && i <= 9 && j >= 1 && j <= GH - 2 && claimed(s, i, j));
        const right = count(s, (i, j) => i >= 11 && i <= GW - 2 && j >= 1 && j <= GH - 2 && claimed(s, i, j));
        const fence = count(s, (i, j) => i === 10 && j >= 1 && j <= GH - 2 && claimed(s, i, j));
        const want = keepLeft ? [0, 28 * 26] : [9 * 26, 0];
        if (left !== want[0] || right !== want[1] || fence !== 26) bad.push(`ball ${keepLeft ? 'left' : 'right'}: claimed left ${left} (want ${want[0]}), right ${right} (want ${want[1]}), fence ${fence}/26`);
        if (claimed(s, Math.floor(s.ball.x), Math.floor(s.ball.y))) bad.push('the ball\'s side got claimed');
      }
      // a little box off the bottom edge claims its fence and inside, nothing else
      const s = mk({ sabotage: sab }), p = s.players[0];
      parkBall(s, 20.5, 8.5);
      put(p, 10, GH - 1);
      const c0 = s.claimed;
      const ev = drive(s, p, path([10, GH - 1], [0, 3], [1, 4], [2, 3]));
      const cl = ev.find((e) => e.type === 'claim');
      const inside = count(s, (i, j) => i >= 11 && i <= 13 && j >= 25 && j <= 26 && claimed(s, i, j));
      if (!cl || s.claimed - c0 !== 15 || inside !== 6 || cl.pts !== 150) bad.push(`box: claimed ${s.claimed - c0} (want 9 fence + 6 inside), inside ${inside}/6, points ${cl && cl.pts} (want 150)`);
      return { ok: !bad.length, info: bad.length ? bad.join('; ') : 'a fence across the field claims the side without the ball (ball right: 234 + 26 fence; ball left: 728 + 26); a 3 x 2 box claims 9 fence + 6 inside, 150 points' };
    },

    percent(sab) {
      const bad = [];
      const s = mk({ sabotage: sab }), p = s.players[0];
      parkBall(s, 30.5, 14.5);
      if (s.pct() !== 0) bad.push(`a new field is ${s.pct()} claimed, not 0`);
      put(p, 10, GH - 1);
      drive(s, p, line([10, GH - 1], 0, GH - 1));
      if (Math.abs(s.pct() - 260 / 988) > 1e-12) bad.push(`after the first fence ${(s.pct() * 100).toFixed(2)} %, want 260 / 988 = 26.32 %`);
      // a slow box on the right scores double, and adds up
      put(p, 30, GH - 1);
      parkBall(s, 20.5, 8.5);
      const ev = drive(s, p, path([30, GH - 1], [0, 3], [1, 4], [2, 3]), { slow: true });
      const cl = ev.find((e) => e.type === 'claim');
      if (Math.abs(s.pct() - 275 / 988) > 1e-12) bad.push(`after the box ${(s.pct() * 100).toFixed(2)} %, want 275 / 988 = 27.83 %`);
      if (!cl || cl.pts !== 300 || !cl.slow) bad.push(`a slow box scored ${cl && cl.pts} (want 300, double)`);
      const real = count(s, (i, j) => claimed(s, i, j));
      if (real !== s.claimed) bad.push(`the claimed count ${s.claimed} doesn't match the field (${real})`);
      if (Math.floor(s.pct() * 100) !== 27) bad.push(`the HUD would show ${Math.floor(s.pct() * 100)} %`);
      return { ok: !bad.length, info: bad.length ? bad.join('; ') : 'new field 0 %; fence across 260 / 988 = 26.32 %; plus a slow box 275 / 988 = 27.83 % (the box scored double: 300); the count matches the field' };
    },

    ball(sab, o = {}) {
      const bad = [];
      let steps = 0, bounces = 0;
      const runs = o.quick ? [[1, true, '1p'], [2, false, '1p']] : [[1, true, '1p'], [2, false, '1p'], [3, true, '2p'], [4, false, '2p'], [5, true, '1p']];
      for (const [seed, easy, mode] of runs) {
        const s = mk({ seed, easy, mode, sabotage: sab });
        const bots = s.players.map((p) => new FB.Bot(s, p, seed * 13 + p.n));
        for (let t = 0; t < 150 && s.state !== 'done'; t += DT) {
          const inp = {};
          for (const b of bots) inp[b.p.id] = b.input();
          s.step(DT, inp);
          for (const e of s.events) if (e.type === 'bounce') bounces++;
          s.events.length = 0;
          if (s.state === 'over') s.keepGoing();
          steps++;
          const b = s.ball;
          if (overlapsLand(s, b.x, b.y) || claimed(s, Math.floor(b.x), Math.floor(b.y))) { bad.push(`seed ${seed}: the ball went into the garden at ${b.x.toFixed(2)}, ${b.y.toFixed(2)} (level ${s.level + 1}, ${(s.pct() * 100).toFixed(0)} %)`); break; }
        }
      }
      return { ok: !bad.length, info: bad.length ? bad.join('; ') : `${steps} steps of autopilot games (EASY, NORMAL, 1P, 2P): the ball always stayed in the open field (${bounces} bounces)` };
    },

    snap(sab) {
      const bad = [];
      for (const easy of [true, false]) {
        const s = mk({ easy, sabotage: sab }), p = s.players[0];
        parkBall(s, 30.5, 8.5);
        put(p, 10, GH - 1);
        drive(s, p, line([10, GH - 1], 0, 8));
        if (p.mode !== 'build' || p.path.length !== 9) { bad.push(`${easy ? 'EASY' : 'NORMAL'}: could not build 8 posts`); continue; }
        // roll the ball at the middle of the fence, from the right
        Object.assign(s.ball, { x: 14.5, y: 23.5, vx: -s.ball.speed, vy: 0, waitT: 0 });
        const lives = s.lives;
        const ev = run(s, {}, 3, (e) => e.some((x) => x.type === 'snap'));
        const fences = count(s, (i, j) => s.fence[j * GW + i] >= 0);
        const ok = ev.some((e) => e.type === 'snap') && fences === 0 && p.mode === 'walk' && p.i === 10 && p.j === GH - 1 && s.lives === lives - (easy ? 0 : 1);
        if (!ok) bad.push(`${easy ? 'EASY' : 'NORMAL'}: snap ${ev.some((e) => e.type === 'snap')}, ${fences} fence posts left, builder ${p.mode} at ${p.i},${p.j}, lives ${lives} → ${s.lives}`);
      }
      // the ball bumping the builder himself, out at the end of his fence
      const s = mk({ sabotage: sab }), p = s.players[0];
      parkBall(s, 30.5, 8.5);
      put(p, 10, GH - 1);
      drive(s, p, path([10, GH - 1], [0, 6], [1, 3]));
      Object.assign(s.ball, { x: 13.5, y: 15.5, vx: 0, vy: s.ball.speed, waitT: 0 });
      const ev = run(s, {}, 3, (e) => e.some((x) => x.type === 'snap'));
      if (!ev.some((e) => e.type === 'snap') || p.mode !== 'walk') bad.push('the ball bumped the builder at the end of his fence and nothing happened');
      return { ok: !bad.length, info: bad.length ? bad.join('; ') : 'the ball hit the middle of an 8-post fence: every post gone, the builder back where he started (EASY: same lives; NORMAL: one life less); bumping the builder at the end does the same' };
    },

    level(sab) {
      const bad = [];
      for (const [easy, cut, want] of [[true, 23, 0.6], [false, 29, 0.75]]) {
        const tag = easy ? 'EASY' : 'NORMAL';
        const s = mk({ easy, sabotage: sab }), p = s.players[0];
        if (s.target !== want) bad.push(`${tag} target ${s.target}`);
        parkBall(s, 37.5, 14.5);
        put(p, cut - 1, GH - 1);
        drive(s, p, line([cut - 1, GH - 1], 0, GH - 1));
        const before = s.pct();
        if (s.state !== 'play' || before >= want) bad.push(`${tag}: ${(before * 100).toFixed(1)} % already ended the level (${s.state})`);
        const ev = drive(s, p, [[cut, 0], ...line([cut, 0], 2, GH - 1)]);
        const closeAt = ev.findIndex((e) => e.type === 'claim'), clearAt = ev.findIndex((e) => e.type === 'clear');
        if (!(s.pct() >= want) || s.state !== 'clear' || clearAt !== closeAt + 1) { bad.push(`${tag}: at ${(s.pct() * 100).toFixed(1)} % the state is ${s.state}`); continue; }
        run(s, {}, FB.CLEAR_T + 0.1);
        if (s.level !== 1 || s.state !== 'play' || s.pct() !== 0) bad.push(`${tag}: after the celebration level ${s.level + 1} ${s.state} ${(s.pct() * 100).toFixed(0)} %`);
      }
      // the last picture: the game is done
      const s = mk({ level: FB.LEVELS.length - 1, sabotage: sab }), p = s.players[0];
      parkBall(s, 37.5, 14.5);
      put(p, 23, GH - 1);
      drive(s, p, line([23, GH - 1], 0, GH - 1));
      run(s, {}, FB.CLEAR_T + 0.1);
      if (s.state !== 'done') bad.push(`after the last picture the state is ${s.state}`);
      return { ok: !bad.length, info: bad.length ? bad.join('; ') : 'EASY: 57.9 % plays on, the fence to 60.5 % ends it on that very step; NORMAL: 73.7 % plays on, 76.3 % ends it; then the next picture starts at 0 %; after the 5th the game is done' };
    },

    stuck(sab, o = {}) {
      const bad = [];
      const moves = (s, p) => [0, 1, 2, 3].filter((d) => s.moveKind(p, d, true));
      // a fence that curls up on itself: the only way out is to roll it back
      {
        const s = mk({ sabotage: sab }), p = s.players[0];
        parkBall(s, 30.5, 8.5);
        put(p, 10, GH - 1);
        drive(s, p, path([10, GH - 1], [0, 5], [1, 2], [2, 2], [3, 1], [0, 1]));
        const m = moves(s, p);
        if (p.i !== 11 || p.j !== 23 || !m.length) bad.push(`curled-up fence: at ${p.i},${p.j} with ${m.length} ways to move`);
        else {
          drive(s, p, [[11, 24], [12, 24], [12, 23], [12, 22], [11, 22], [10, 22], [10, 23], [10, 24], [10, 25], [10, 26], [10, 27]]);
          if (p.mode !== 'walk' || p.i !== 10 || p.j !== GH - 1 || count(s, (i, j) => s.fence[j * GW + i] >= 0)) bad.push(`rolling back: ${p.mode} at ${p.i},${p.j}`);
        }
      }
      // 2P: Teddy's fence turns the land under Tommy into garden: Tommy steps out to the edge and can move
      {
        const s = mk({ mode: '2p', sabotage: sab }), [T, M] = s.players;
        parkBall(s, 30.5, 8.5);
        put(T, 12, GH - 1);
        put(M, 5, GH - 1);
        drive(s, T, path([12, GH - 1], [0, 7], [3, 12]));
        const m = moves(s, M);
        if (!s.isEdge(M.i, M.j) || !m.length) bad.push(`Tommy left inside new garden at ${M.i},${M.j}: edge ${s.isEdge(M.i, M.j)}, ${m.length} ways to move`);
      }
      // random key mashing: there's always a way to move, and walking builders stay on the edge
      {
        const runs = o.quick ? 6 : 16;
        let checked = 0;
        for (let r = 0; r < runs && bad.length < 3; r++) {
          const s = mk({ seed: 100 + r, easy: r % 2 === 0, mode: r % 3 === 2 ? '2p' : '1p', sabotage: sab });
          const rng = FB.mulberry(900 + r);
          const held = {};
          for (const p of s.players) held[p.id] = { dir: -1, build: false, slow: false, t: 0 };
          for (let t = 0; t < 70 && bad.length < 3; t += DT) {
            const inp = {};
            for (const p of s.players) {
              const h = held[p.id];
              if ((h.t -= DT) <= 0) Object.assign(h, { dir: rng() < 0.15 ? -1 : Math.floor(rng() * 4), build: rng() < 0.75, slow: rng() < 0.3, t: 0.05 + rng() * 0.9 });
              inp[p.id] = h;
            }
            if (rng() < 0.002) s.callBuddy();
            s.step(DT, inp);
            s.events.length = 0;
            if (s.state === 'over') s.keepGoing();
            if (s.state !== 'play') continue;
            for (const p of s.players) {
              if (p.oopsT > 1.0) bad.push(`seed ${100 + r}: ${p.id} is stunned for ${p.oopsT.toFixed(1)} s`);
              if (p.oopsT > 0 || p.ti >= 0) continue;
              checked++;
              if (p.mode === 'walk' && !s.isEdge(p.i, p.j)) bad.push(`seed ${100 + r}: ${p.id} walking off the edge at ${p.i},${p.j}`);
              else if (!moves(s, p).length) bad.push(`seed ${100 + r}: ${p.id} stuck at ${p.i},${p.j} (${p.mode}, level ${s.level + 1})`);
            }
          }
        }
        if (!bad.length) o.mashed = checked;
      }
      // the autopilot finishes all 5 pictures (a game can't jam)
      {
        const runs = o.quick ? [['1p', true]] : [['1p', true], ['2p', true], ['1p', false], ['2p', false]];
        for (const [mode, easy] of runs) {
          const s = mk({ seed: 7, mode, easy, sabotage: sab });
          const bots = s.players.map((p) => new FB.Bot(s, p, 31 + p.n));
          let t = 0;
          for (; t < 1200 && s.state !== 'done'; t += DT) {
            const inp = {};
            for (const b of bots) inp[b.p.id] = b.input();
            s.step(DT, inp);
            s.events.length = 0;
            if (s.state === 'over') s.keepGoing();
          }
          if (s.state !== 'done') bad.push(`autopilot ${mode} ${easy ? 'EASY' : 'NORMAL'}: stuck on picture ${s.level + 1} at ${(s.pct() * 100).toFixed(0)} % after ${t.toFixed(0)} s`);
          else o.soak = (o.soak || []).concat(`${mode} ${easy ? 'EASY' : 'NORMAL'} ${t.toFixed(0)} s`);
        }
      }
      return { ok: !bad.length, info: bad.length ? bad.slice(0, 3).join('; ') : `a curled-up fence rolls back home; Tommy left inside Teddy's new garden steps to the edge; ${o.mashed} standing moments of random keys all had a way to move; the autopilot finished all 5 pictures (${(o.soak || []).join(', ')})` };
    },

    freeze(sab) {
      const bad = [];
      const s = mk({ sabotage: sab, buddy: 'tommy' });
      run(s, {}, 1.5);
      s.callBuddy();
      const ev = run(s, {}, 4, (e) => e.some((x) => x.type === 'freeze'));
      const types = ev.map((e) => e.type);
      for (const t of ['buddyIn', 'gift', 'freeze']) if (!types.includes(t)) bad.push(`no ${t}`);
      const x0 = s.ball.x, y0 = s.ball.y;
      run(s, {}, 4.9);
      const still = Math.hypot(s.ball.x - x0, s.ball.y - y0);
      run(s, {}, 0.4);
      const moved = Math.hypot(s.ball.x - x0, s.ball.y - y0);
      if (still > 1e-9 || moved < 0.3) bad.push(`ball moved ${still.toFixed(2)} in the 4.9 s freeze, then ${moved.toFixed(2)}`);
      // the high five (2P)
      const s2 = mk({ mode: '2p', sabotage: sab });
      run(s2, {}, 1.5);
      s2.callBuddy();
      const a = [s2.ball.x, s2.ball.y];
      run(s2, {}, 2.9);
      const st2 = Math.hypot(s2.ball.x - a[0], s2.ball.y - a[1]);
      run(s2, {}, 0.4);
      const mv2 = Math.hypot(s2.ball.x - a[0], s2.ball.y - a[1]);
      if (st2 > 1e-9 || mv2 < 0.3) bad.push(`high five: ball moved ${st2.toFixed(2)} in 2.9 s, then ${mv2.toFixed(2)}`);
      return { ok: !bad.length, info: bad.length ? bad.join('; ') : 'the brother pops in, tosses a treat and the ball stays put for 5 s, then bounces on; the 2P high five holds it 3 s' };
    },

    frames(sab) {
      // the same keys (by game time) at different frame rates
      const keysAt = (t) => (t < 1.6 ? { dir: 0, build: true } : t < 2.6 ? { dir: 1, build: true } : t < 4.2 ? { dir: 2, build: true } : t < 6 ? { dir: 3 } : {});
      const play = (frame) => {
        const s = mk({ seed: 9 }), r = new FB.Runner(s, { rawDt: sab === 'rawDt' });
        const p = s.players[0];
        let t = 0, k = 0, snap = 'never got there';
        const shot = () => `${s.score} ${s.claimed} ${p.i},${p.j} ${s.ball.x.toFixed(4)},${s.ball.y.toFixed(4)}`;
        while (t < 8.5) {
          const dt = typeof frame === 'number' ? frame : frame(k++);
          r.advance(dt, () => {
            if (Math.abs(s.t - 7.5) < DT / 2) snap = shot(); // the same moment of game time, whatever the frames
            return { [p.id]: keysAt(s.t) };
          });
          t += dt;
        }
        return sab === 'rawDt' && snap === 'never got there' ? shot() : snap;
      };
      const ref = play(1 / 60);
      const res = { '30': play(1 / 30), '120': play(1 / 120), jumpy: play((k) => [1 / 60, 1 / 25, 1 / 90, 1 / 144][k % 4]) };
      const off = Object.entries(res).filter(([, v]) => v !== ref).map(([k, v]) => `${k} fps: ${v}`);
      return { ok: !off.length, info: off.length ? `60 fps: ${ref}; ${off.join('; ')}` : `30, 60, 120 fps and a jumpy frame rate give the same game (${ref})` };
    },
  };

  // which broken rule each check must catch
  const SABOTAGE = [['claim', 'wrongSide'], ['percent', 'badPct'], ['ball', 'ballThrough'], ['snap', 'noSnap'], ['level', 'neverEnd'], ['stuck', 'noRollBack'], ['stuck', 'noEdgeSnap'], ['freeze', 'noFreeze'], ['frames', 'rawDt']];

  function runAll(o = {}) {
    const lines = [], fails = [];
    for (const name of Object.keys(CHECKS)) {
      let r;
      try { r = CHECKS[name](null, { quick: o.quick }); } catch (e) { r = { ok: false, info: String(e && e.stack || e) }; }
      lines.push(`${r.ok ? '✓' : '✗'} ${name}: ${r.info}`);
      if (!r.ok) fails.push(name);
    }
    return { ok: !fails.length, lines, fails };
  }

  function prove() {
    const lines = [], missed = [];
    for (const [name, sab] of SABOTAGE) {
      let r;
      try { r = CHECKS[name](sab, { quick: true }); } catch (e) { r = { ok: false, info: 'threw ' + String(e && e.message || e) }; }
      lines.push(`${r.ok ? '✗ NOT CAUGHT' : '✓ caught'}: ${name} with "${sab}" → ${String(r.info).slice(0, 170)}`);
      if (r.ok) missed.push(`${name}/${sab}`);
    }
    return { ok: !missed.length, lines, missed };
  }

  FB.checks = { run: runAll, prove, CHECKS, SABOTAGE };
})(typeof window !== 'undefined' ? window : globalThis);
