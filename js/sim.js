/* TT Fence Builder: the rules, with no Three.js (so they also run in Node for the headless check).
   The field is a grid of GW x GH cells seen from above. Cell (i, j): i goes left to right, j goes from the far edge
   (j = 0, the top of the screen) toward the camera (j = GH - 1, the bottom). The outer ring starts as claimed land.
   - A builder walks along the edge of the claimed land (claimed cells next to the open field). Holding BUILD while
     stepping into the open field starts a fence; once out there he keeps building wherever he walks (no key needed),
     and walking back along his own fence rolls it back up. A slow build (holding SLOW the whole way) scores double.
   - Stepping back onto claimed land closes the fence: the fence and every part of the open field without the ball
     turn into garden (claimed land), which shows the level's hidden picture.
   - The beach ball bounces around the open field only. If it touches a fence that's still being built (or the
     builder out on it), the fence snaps back to where it started: free on EASY, a life on NORMAL.
   - NORMAL: sparkly bugs patrol the edges; one that bumps a builder on the edge costs a life (it sneezes into confetti
     and floats away). EASY has none.
   - Claim the target (EASY 60 %, NORMAL 75 %) to finish the level and see the whole picture. 5 pictures.
   - The companion (1P): the other brother pops in, does his signature move, tosses a treat and freezes the ball for
     5 seconds. 2P: T is a high five (and a 3 s freeze).
   Time: the rules always step by DT = 1/120 s (FB.Runner), so the frame rate never changes the game. Randomness comes
   from a seeded generator. o.sabotage breaks one rule on purpose, so the checks (js/checks.js) can prove they notice. */
(function (root) {
  'use strict';
  const FB = (root.FB = root.FB || {});
  const DT = 1 / 120;
  const GW = 40, GH = 28;
  const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // 0 up (away from the camera), 1 right, 2 down (toward it), 3 left
  const BALL_R = 0.45;           // the ball's size for the rules, in cells (it's drawn a little bigger and squishes)
  const BODY_R = 0.3;            // a builder out on his fence, for the ball
  const BUG_HIT = 0.72;          // a bug this close to a builder bumps him
  const CLEAR_T = 3.4;           // the celebration between levels
  const FREEZE = 5;              // the brother freezes the ball this long
  const HI5_FREEZE = 3, HI5_CD = 15;
  const TREATS = [['🍦', 'ICE CREAM'], ['💧', 'WATER'], ['🧃', 'JUICE'], ['🍪', 'COOKIE'], ['🍉', 'WATERMELON'], ['🍌', 'BANANA']];
  const LEVELS = [
    { pic: 'panda', name: 'PANDA', emoji: '🐼' },
    { pic: 'rocket', name: 'ROCKET', emoji: '🚀' },
    { pic: 'boat', name: 'DRAGON BOAT', emoji: '🐉' },
    { pic: 'whale', name: 'WHALE', emoji: '🐳' },
    { pic: 'cake', name: 'BIRTHDAY CAKE', emoji: '🎂' },
  ];
  const DIFF = {
    easy: { target: 0.6, lives: 5, snapFree: true, bugs: [0, 0, 0, 0, 0], ball: [3.4, 3.7, 4.0, 4.3, 4.6], walk: 8, build: 6, slow: 3, bugSpeed: [0, 0, 0, 0, 0] },
    normal: { target: 0.75, lives: 3, snapFree: false, bugs: [1, 2, 2, 3, 3], ball: [5.2, 5.7, 6.2, 6.7, 7.2], walk: 9, build: 7, slow: 3.5, bugSpeed: [3.2, 3.5, 3.8, 4.1, 4.4] },
  };

  function mulberry(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const idx = (i, j) => j * GW + i;
  const inb = (i, j) => i >= 0 && j >= 0 && i < GW && j < GH;
  // does a circle (in cell units) overlap cell (i, j)?
  function circleCell(cx, cy, r, i, j) {
    const dx = cx - clamp(cx, i, i + 1), dy = cy - clamp(cy, j, j + 1);
    return dx * dx + dy * dy < r * r;
  }

  // ---------------------------------------------------------------- the game
  function Sim(o) {
    this.o = Object.assign({ level: 0, mode: '1p', hero: 'teddy', buddy: null, easy: true, seed: 1, sabotage: null, quiet: false }, o);
    this.rng = mulberry(this.o.seed);
    this.d = this.o.easy ? DIFF.easy : DIFF.normal;
    this.target = this.d.target;
    this.lives = this.d.lives;
    this.score = 0;
    this.events = [];
    this.t = 0;
    this.cl = new Uint8Array(GW * GH);
    this.fence = new Int8Array(GW * GH);
    const ids = this.o.mode === '2p' ? ['teddy', 'tommy'] : [this.o.hero];
    this.players = ids.map((id, n) => ({ id, n, i: 0, j: 0, ti: -1, tj: -1, prog: 0, mode: 'walk', path: [], slow: true, kind: '', kslow: false, face: 0,
      oopsT: 0, inv: 0, hi5T: 0, built: 0, claims: 0 }));
    this.buddy = null;
    this.hi5Cd = 0;
    this.treat = 0;
    this.bugSeq = 0;
    this.startLevel(this.o.level);
  }

  Sim.prototype.startLevel = function (n) {
    this.level = n;
    this.cl.fill(0);
    this.fence.fill(-1);
    let border = 0;
    for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) if (i === 0 || j === 0 || i === GW - 1 || j === GH - 1) { this.cl[idx(i, j)] = 1; border++; }
    this.border = border;
    this.interior = GW * GH - border;
    this.claimed = border;
    const two = this.players.length === 2;
    for (const p of this.players) {
      Object.assign(p, { i: two ? (p.n === 0 ? 13 : 26) : GW / 2, j: GH - 1, ti: -1, tj: -1, prog: 0, mode: 'walk', path: [], slow: true, kind: '', face: 0, oopsT: 0, inv: 0, hi5T: 0 });
    }
    const r = this.rng;
    const a = (Math.PI / 6 + r() * Math.PI / 6) + Math.floor(r() * 4) * (Math.PI / 2);
    const s = this.d.ball[Math.min(n, this.d.ball.length - 1)];
    this.ball = { x: GW * (0.35 + r() * 0.3), y: GH * (0.3 + r() * 0.3), vx: Math.cos(a) * s, vy: Math.sin(a) * s, speed: s, waitT: 1.2, frozenT: 0, bounces: 0 };
    this.bugs = [];
    const nb = this.d.bugs[Math.min(n, this.d.bugs.length - 1)];
    for (let k = 0; k < nb; k++) this.bugs.push({ id: ++this.bugSeq, i: Math.round((GW * (k + 1)) / (nb + 1)), j: 0, pi: -1, pj: -1, ti: -1, tj: -1, prog: 0, goneT: k * 1.5, face: 1 });
    this.buddy = null;
    this.state = 'play';
    this.stateT = 0;
    this.events.push({ type: 'level', level: n });
  };

  Sim.prototype.player = function (id) { return this.players.find((p) => p.id === id); };
  Sim.prototype.pct = function () {
    if (this.o.sabotage === 'badPct') return (this.claimed) / (GW * GH);
    return (this.claimed - this.border) / this.interior;
  };
  Sim.prototype.isClaimed = function (i, j) { return !inb(i, j) || this.cl[idx(i, j)] === 1; };
  // the edge of the claimed land: a claimed cell next to (or across a corner from) the open field
  Sim.prototype.isEdge = function (i, j) {
    if (!inb(i, j) || !this.cl[idx(i, j)]) return false;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const a = i + di, b = j + dj;
      if ((di || dj) && inb(a, b) && !this.cl[idx(a, b)]) return true;
    }
    return false;
  };
  // where a builder (or bug) is, in cell units (the middle of a cell is +0.5)
  Sim.prototype.pos = function (p) {
    if (p.ti < 0) return { x: p.i + 0.5, y: p.j + 0.5 };
    return { x: p.i + 0.5 + (p.ti - p.i) * p.prog, y: p.j + 0.5 + (p.tj - p.j) * p.prog };
  };
  Sim.prototype.ballBlocks = function (i, j) {
    const b = this.ball;
    return b.frozenT > 0 && circleCell(b.x, b.y, BALL_R, i, j);
  };
  Sim.prototype.ballOverlapsClaimed = function (x, y) {
    if (this.o.sabotage === 'ballThrough') return x - BALL_R < 1 || y - BALL_R < 1 || x + BALL_R > GW - 1 || y + BALL_R > GH - 1; // only the outer ring
    for (let j = Math.floor(y - BALL_R); j <= Math.floor(y + BALL_R); j++)
      for (let i = Math.floor(x - BALL_R); i <= Math.floor(x + BALL_R); i++)
        if (this.isClaimed(i, j) && circleCell(x, y, BALL_R, i, j)) return true;
    return false;
  };

  // ---------------------------------------------------------------- one step
  Sim.prototype.step = function (dt, inputs = {}) {
    this.t += dt;
    this.stateT += dt;
    this.hi5Cd = Math.max(0, this.hi5Cd - dt);
    for (const p of this.players) { p.hi5T = Math.max(0, p.hi5T - dt); p.inv = Math.max(0, p.inv - dt); }
    if (this.state === 'play') {
      for (const p of this.players) {
        if (this.state !== 'play') break;
        this.stepPlayer(p, inputs[p.id] || {}, dt);
      }
      if (this.state === 'play') this.stepBall(dt);
      if (this.state === 'play') this.stepBugs(dt);
    } else if (this.state === 'clear' && this.stateT >= CLEAR_T) {
      if (this.level >= LEVELS.length - 1) { this.state = 'done'; this.stateT = 0; this.events.push({ type: 'done' }); }
      else this.startLevel(this.level + 1);
    }
    this.stepBuddy(dt);
  };

  Sim.prototype.speedOf = function (p) {
    const d = this.d;
    if (p.kind === 'walk') return d.walk;
    if (p.kind === 'back') return d.build * 1.25;
    return p.kslow ? d.slow : d.build;
  };

  Sim.prototype.stepPlayer = function (p, inp, dt) {
    if (p.oopsT > 0) {
      p.oopsT -= dt;
      if (p.oopsT > 0) return;
      p.oopsT = 0;
    }
    let budget = dt;
    for (let guard = 0; guard < 4; guard++) {
      if (p.ti < 0 && !this.tryStart(p, inp)) break;
      const sp = this.speedOf(p);
      const need = (1 - p.prog) / sp;
      if (budget < need) { p.prog += budget * sp; break; }
      budget -= need;
      this.arrive(p);
      if (this.state !== 'play' || p.oopsT > 0) break;
    }
  };

  // can this builder step that way right now? (and what would the step be)
  Sim.prototype.moveKind = function (p, dir, build) {
    const [di, dj] = DIRS[dir];
    const ni = p.i + di, nj = p.j + dj;
    if (!inb(ni, nj)) return null;
    const k = idx(ni, nj);
    if (p.mode === 'walk') {
      if (this.cl[k]) return this.isEdge(ni, nj) ? 'walk' : null;
      if (!build || this.fence[k] >= 0 || this.ballBlocks(ni, nj)) return null;
      return 'start';
    }
    const prev = p.path[p.path.length - 2];
    if (prev && prev[0] === ni && prev[1] === nj) return this.o.sabotage === 'noRollBack' ? null : 'back';
    if (this.cl[k]) return 'close';
    if (this.fence[k] >= 0 || this.ballBlocks(ni, nj)) return null;
    return 'build';
  };

  Sim.prototype.tryStart = function (p, inp) {
    const dir = inp.dir;
    if (dir == null || dir < 0) return false;
    p.face = dir;
    const kind = this.moveKind(p, dir, !!inp.build);
    if (!kind) return false;
    const [di, dj] = DIRS[dir];
    const ni = p.i + di, nj = p.j + dj;
    if (kind === 'start') {
      p.mode = 'build';
      p.path = [[p.i, p.j]];
      p.slow = true;
      this.events.push({ type: 'buildStart', who: p.id });
    }
    if (kind === 'start' || kind === 'build') {
      this.fence[idx(ni, nj)] = p.n;
      p.path.push([ni, nj]);
      p.kind = 'build';
      p.kslow = !!inp.slow;
      if (!inp.slow) p.slow = false;
      p.built++;
      this.events.push({ type: 'post', who: p.id, i: ni, j: nj, slow: p.kslow });
    } else if (kind === 'back') {
      this.fence[idx(p.i, p.j)] = -1;
      p.path.pop();
      p.kind = 'back';
      this.events.push({ type: 'rollback', who: p.id, i: p.i, j: p.j });
    } else p.kind = kind; // walk, close
    p.ti = ni;
    p.tj = nj;
    p.prog = 0;
    return true;
  };

  Sim.prototype.arrive = function (p) {
    p.i = p.ti;
    p.j = p.tj;
    p.ti = p.tj = -1;
    p.prog = 0;
    if (p.kind === 'close') this.close(p);
    else if (p.kind === 'back' && p.path.length <= 1) { p.mode = 'walk'; p.path = []; }
    p.kind = '';
  };

  // the fence is closed: it and every part of the open field without the ball become garden
  Sim.prototype.close = function (p) {
    const cells = p.path.slice(1);
    let n = 0;
    for (const [i, j] of cells) {
      const k = idx(i, j);
      this.fence[k] = -1;
      if (!this.cl[k]) { this.cl[k] = 1; n++; }
    }
    // the open field falls into pieces; the piece with the ball stays open
    const lab = new Int32Array(GW * GH).fill(-1);
    const sizes = [];
    const q = new Int32Array(GW * GH);
    for (let s = 0; s < GW * GH; s++) {
      if (this.cl[s] || lab[s] >= 0) continue;
      const L = sizes.length;
      let h = 0, t = 0, size = 0;
      q[t++] = s;
      lab[s] = L;
      while (h < t) {
        const c = q[h++];
        size++;
        const ci = c % GW, cj = (c - ci) / GW;
        for (const [di, dj] of DIRS) {
          const a = ci + di, b = cj + dj;
          if (!inb(a, b)) continue;
          const k = idx(a, b);
          if (!this.cl[k] && lab[k] < 0) { lab[k] = L; q[t++] = k; }
        }
      }
      sizes.push(size);
    }
    const b = this.ball;
    let keep = lab[idx(clamp(Math.floor(b.x), 0, GW - 1), clamp(Math.floor(b.y), 0, GH - 1))];
    if (keep < 0) keep = sizes.indexOf(Math.max(...sizes, 0)); // can't happen: the ball is always in the open field
    if (this.o.sabotage === 'wrongSide' && sizes.length > 1) {
      let best = -1;
      for (let L = 0; L < sizes.length; L++) if (L !== keep && (best < 0 || sizes[L] > sizes[best])) best = L;
      keep = best;
    }
    const cut = new Set();
    for (let k = 0; k < GW * GH; k++) {
      if (this.cl[k] || lab[k] === keep) continue;
      this.cl[k] = 1;
      n++;
      if (this.fence[k] >= 0) { cut.add(this.fence[k]); this.fence[k] = -1; }
    }
    this.claimed += n;
    const pts = n * 10 * (p.slow ? 2 : 1);
    this.score += pts;
    p.claims++;
    p.mode = 'walk';
    p.path = [];
    const at = this.pos(p);
    this.events.push({ type: 'claim', who: p.id, cells: n, pts, slow: p.slow, pct: this.pct(), x: at.x, y: at.y });
    this.afterFill(cut);
    if (this.pct() >= this.target - 1e-9 && this.o.sabotage !== 'neverEnd') this.clearLevel();
  };

  // after the land changes: anyone left off the edge steps to the nearest edge, cut fences snap back
  Sim.prototype.afterFill = function (cut) {
    for (const q of this.players) {
      if (q.mode !== 'build') continue;
      const onLand = this.cl[idx(q.i, q.j)] === 1;
      let broken = cut.has(q.n) || onLand;
      for (let k = 1; k < q.path.length && !broken; k++) if (this.cl[idx(q.path[k][0], q.path[k][1])]) broken = true;
      if (!broken) continue;
      for (let k = 1; k < q.path.length; k++) { const c = idx(q.path[k][0], q.path[k][1]); if (this.fence[c] === q.n) this.fence[c] = -1; }
      if (!onLand) { q.i = q.path[0][0]; q.j = q.path[0][1]; }
      q.mode = 'walk';
      q.path = [];
      q.ti = q.tj = -1;
      q.prog = 0;
      q.kind = '';
      if (!onLand) this.events.push({ type: 'snap', who: q.id, lost: false, cut: true });
    }
    if (this.o.sabotage === 'noEdgeSnap') return;
    for (const q of this.players) this.toEdge(q);
    for (const g of this.bugs) this.toEdge(g);
    const b = this.ball;
    if (this.ballOverlapsClaimed(b.x, b.y)) { b.x = Math.floor(b.x) + 0.5; b.y = Math.floor(b.y) + 0.5; }
  };

  // a builder (walking) or a bug that isn't on the edge any more goes to the nearest edge cell
  Sim.prototype.toEdge = function (q) {
    if (q.mode === 'build') return;
    if (q.ti >= 0 && !this.isEdge(q.ti, q.tj)) { q.ti = q.tj = -1; q.prog = 0; q.kind = ''; }
    if (this.isEdge(q.i, q.j)) return;
    const e = this.nearestEdge(q.i, q.j);
    if (e) { q.i = e[0]; q.j = e[1]; q.ti = q.tj = -1; q.prog = 0; q.kind = ''; q.pi = q.pj = -1; }
  };

  Sim.prototype.nearestEdge = function (i0, j0) {
    const seen = new Uint8Array(GW * GH), q = [[i0, j0]];
    seen[idx(i0, j0)] = 1;
    for (let h = 0; h < q.length; h++) {
      const [i, j] = q[h];
      if (this.isEdge(i, j)) return [i, j];
      for (const [di, dj] of DIRS) {
        const a = i + di, b = j + dj;
        if (inb(a, b) && !seen[idx(a, b)]) { seen[idx(a, b)] = 1; q.push([a, b]); }
      }
    }
    return null;
  };

  // the ball touched a fence (or its builder): the fence snaps back to where it started
  Sim.prototype.snap = function (p) {
    for (let k = 1; k < p.path.length; k++) { const c = idx(p.path[k][0], p.path[k][1]); if (this.fence[c] === p.n) this.fence[c] = -1; }
    const at = this.pos(p);
    const start = p.path[0] || [p.i, p.j];
    const cells = p.path.slice(1);
    p.i = start[0];
    p.j = start[1];
    p.ti = p.tj = -1;
    p.prog = 0;
    p.kind = '';
    p.mode = 'walk';
    p.path = [];
    const lose = !this.d.snapFree;
    this.events.push({ type: 'snap', who: p.id, lost: lose, x: at.x, y: at.y, cells, si: start[0], sj: start[1] });
    this.toEdge(p);
    if (lose) this.loseLife(p);
    else p.oopsT = 0.35;
  };

  Sim.prototype.loseLife = function (p) {
    this.lives--;
    p.oopsT = this.o.sabotage === 'stuckOops' ? 1e9 : 0.8;
    p.inv = 2.2;
    this.events.push({ type: 'oops', who: p.id, lives: this.lives });
    if (this.lives <= 0) {
      this.state = 'over';
      this.stateT = 0;
      for (const q of this.players) this.dropFence(q);
      this.events.push({ type: 'over' });
    }
  };

  Sim.prototype.dropFence = function (q) {
    if (q.mode !== 'build') return;
    for (let k = 1; k < q.path.length; k++) { const c = idx(q.path[k][0], q.path[k][1]); if (this.fence[c] === q.n) this.fence[c] = -1; }
    q.i = q.path[0][0];
    q.j = q.path[0][1];
    q.mode = 'walk';
    q.path = [];
    q.ti = q.tj = -1;
    q.prog = 0;
    q.kind = '';
    this.toEdge(q);
  };

  // out of lives: carry on with full lives, the garden stays
  Sim.prototype.keepGoing = function () {
    if (this.state !== 'over') return;
    this.lives = this.d.lives;
    this.state = 'play';
    this.stateT = 0;
    for (const p of this.players) { p.oopsT = 0; p.inv = 2; }
    this.ball.waitT = 1;
  };

  Sim.prototype.clearLevel = function () {
    const over = Math.max(0, Math.floor((this.pct() - this.target) * 100 + 1e-6));
    const bonus = 1000 * (this.level + 1) + over * 100;
    this.score += bonus;
    this.state = 'clear';
    this.stateT = 0;
    for (const q of this.players) { this.dropFence(q); q.ti = q.tj = -1; q.prog = 0; q.oopsT = 0; }
    if (this.buddy && this.buddy.state !== 'leave') { this.buddy.state = 'leave'; this.buddy.t = 0; this.events.push({ type: 'buddyOut', who: this.buddy.id }); }
    this.ball.frozenT = 0;
    this.events.push({ type: 'clear', level: this.level, bonus, pct: this.pct(), last: this.level >= LEVELS.length - 1 });
  };

  // ---------------------------------------------------------------- the ball
  Sim.prototype.stepBall = function (dt) {
    const b = this.ball;
    if (b.waitT > 0) { b.waitT -= dt; return; }
    if (b.frozenT > 0) {
      b.frozenT -= dt;
      if (b.frozenT <= 0) { b.frozenT = 0; this.events.push({ type: 'thaw' }); }
    } else {
      const dist = b.speed * dt, n = Math.max(1, Math.ceil(dist / 0.2));
      let bounced = false;
      for (let s = 0; s < n; s++) {
        const h = dt / n;
        const nx = b.x + b.vx * h;
        if (this.ballOverlapsClaimed(nx, b.y)) { b.vx = -b.vx; bounced = true; } else b.x = nx;
        const ny = b.y + b.vy * h;
        if (this.ballOverlapsClaimed(b.x, ny)) { b.vy = -b.vy; bounced = true; } else b.y = ny;
      }
      if (bounced) {
        // a little wobble on every bounce, never flat along a wall
        let a = Math.atan2(b.vy, b.vx) + (this.rng() - 0.5) * 0.22;
        let cx = Math.cos(a), cy = Math.sin(a);
        const m = 0.38;
        if (Math.abs(cx) < m) cx = Math.sign(b.vx || 1) * m;
        if (Math.abs(cy) < m) cy = Math.sign(b.vy || 1) * m;
        if (Math.sign(cx) !== Math.sign(b.vx) && b.vx) cx = -cx;
        if (Math.sign(cy) !== Math.sign(b.vy) && b.vy) cy = -cy;
        const len = Math.hypot(cx, cy);
        b.vx = (cx / len) * b.speed;
        b.vy = (cy / len) * b.speed;
        b.bounces++;
        this.events.push({ type: 'bounce', x: b.x, y: b.y });
      }
    }
    // touching a fence that's still being built (or its builder out on it)
    for (const p of this.players) {
      if (p.mode !== 'build' || this.o.sabotage === 'noSnap') continue;
      let hit = false;
      for (let k = 1; k < p.path.length && !hit; k++) if (circleCell(b.x, b.y, BALL_R, p.path[k][0], p.path[k][1])) hit = true;
      if (!hit) { const at = this.pos(p); hit = Math.hypot(at.x - b.x, at.y - b.y) < BALL_R + BODY_R; }
      if (hit) { this.snap(p); if (this.state !== 'play') return; }
    }
  };

  // ---------------------------------------------------------------- the sparkly bugs (NORMAL)
  Sim.prototype.stepBugs = function (dt) {
    const sp = this.d.bugSpeed[Math.min(this.level, this.d.bugSpeed.length - 1)];
    for (const g of this.bugs) {
      if (g.goneT > 0) {
        g.goneT -= dt;
        if (g.goneT <= 0) { this.respawnBug(g); this.events.push({ type: 'bugIn', id: g.id }); }
        continue;
      }
      let budget = dt;
      for (let guard = 0; guard < 3; guard++) {
        if (g.ti < 0 && !this.bugNext(g)) break;
        const need = (1 - g.prog) / sp;
        if (budget < need) { g.prog += budget * sp; break; }
        budget -= need;
        g.pi = g.i; g.pj = g.j;
        g.i = g.ti; g.j = g.tj;
        g.ti = g.tj = -1;
        g.prog = 0;
      }
      const at = this.pos(g);
      for (const p of this.players) {
        if (p.mode !== 'walk' || p.inv > 0 || p.oopsT > 0) continue;
        const pp = this.pos(p);
        if (Math.hypot(pp.x - at.x, pp.y - at.y) < BUG_HIT) {
          g.goneT = 4;
          this.events.push({ type: 'bugPop', id: g.id, x: at.x, y: at.y, who: p.id });
          this.loseLife(p);
          break;
        }
      }
      if (this.state !== 'play') return;
    }
  };

  // bugs patrol the edge: mostly straight on, sometimes toward the nearest builder, never back unless they must
  Sim.prototype.bugNext = function (g) {
    const opts = [];
    for (let d = 0; d < 4; d++) {
      const a = g.i + DIRS[d][0], b = g.j + DIRS[d][1];
      if (this.isEdge(a, b)) opts.push(d);
    }
    if (!opts.length) return false;
    let fwd = opts.filter((d) => !(g.i + DIRS[d][0] === g.pi && g.j + DIRS[d][1] === g.pj));
    if (!fwd.length) fwd = opts;
    let d;
    const r = this.rng();
    if (fwd.includes(g.face) && r < 0.55) d = g.face;
    else if (r < 0.8) {
      let best = Infinity;
      for (const p of this.players) {
        if (p.mode !== 'walk') continue;
        for (const o of fwd) {
          const m = Math.abs(g.i + DIRS[o][0] - p.i) + Math.abs(g.j + DIRS[o][1] - p.j);
          if (m < best) { best = m; d = o; }
        }
      }
    }
    if (d == null) d = fwd[Math.floor(this.rng() * fwd.length)];
    g.face = d;
    g.ti = g.i + DIRS[d][0];
    g.tj = g.j + DIRS[d][1];
    g.prog = 0;
    return true;
  };

  Sim.prototype.respawnBug = function (g) {
    let best = null, bd = -1;
    for (let tries = 0; tries < 60; tries++) {
      const i = Math.floor(this.rng() * GW), j = Math.floor(this.rng() * GH);
      const e = this.isEdge(i, j) ? [i, j] : null;
      if (!e) continue;
      let dmin = Infinity;
      for (const p of this.players) dmin = Math.min(dmin, Math.abs(p.i - i) + Math.abs(p.j - j));
      if (dmin > bd) { bd = dmin; best = e; }
    }
    if (!best) best = this.nearestEdge(GW >> 1, 0) || [GW >> 1, 0];
    Object.assign(g, { i: best[0], j: best[1], pi: -1, pj: -1, ti: -1, tj: -1, prog: 0 });
  };

  // ---------------------------------------------------------------- the companion and the high five
  Sim.prototype.callBuddy = function () {
    if (this.state !== 'play') return false;
    if (this.players.length === 2) {
      if (this.hi5Cd > 0) return false;
      this.hi5Cd = HI5_CD;
      for (const p of this.players) p.hi5T = 1.3;
      const b = this.ball;
      if (this.o.sabotage !== 'noFreeze') b.frozenT = Math.max(b.frozenT, HI5_FREEZE);
      const a = this.pos(this.players[0]), c = this.pos(this.players[1]);
      this.events.push({ type: 'highfive', x: (a.x + c.x) / 2, y: (a.y + c.y) / 2 });
      return true;
    }
    const B = this.buddy;
    if (B && B.state !== 'leave') {
      B.queued++;
      if (B.state === 'stay') { B.state = 'give'; B.t = 0; B.queued--; this.gift(); }
      return true;
    }
    const hero = this.players[0];
    const id = this.o.buddy || (hero.id === 'tommy' ? 'teddy' : 'tommy');
    const spot = this.buddySpot(hero);
    this.buddy = { id, state: 'enter', t: 0, x: spot[0] + 0.5, y: spot[1] + 0.5, queued: 0 };
    this.events.push({ type: 'buddyIn', who: id });
    return true;
  };

  // a claimed cell a couple of steps from the hero, for the brother to stand on
  Sim.prototype.buddySpot = function (hero) {
    const seen = new Uint8Array(GW * GH), q = [[hero.i, hero.j, 0]];
    seen[idx(hero.i, hero.j)] = 1;
    for (let h = 0; h < q.length; h++) {
      const [i, j, d] = q[h];
      if (d >= 2 && this.cl[idx(i, j)]) return [i, j];
      for (const [di, dj] of DIRS) {
        const a = i + di, b = j + dj;
        if (inb(a, b) && !seen[idx(a, b)]) { seen[idx(a, b)] = 1; q.push([a, b, d + 1]); }
      }
    }
    return [hero.i, hero.j];
  };

  Sim.prototype.gift = function () {
    const B = this.buddy, hero = this.players[0];
    const [emoji, name] = TREATS[this.treat++ % TREATS.length];
    this.score += 100;
    const heal = !this.o.easy && this.lives < this.d.lives;
    if (heal) this.lives++;
    const at = this.pos(hero);
    this.events.push({ type: 'gift', from: B.id, emoji, name, heal, x: B.x, y: B.y, tx: at.x, ty: at.y });
  };

  Sim.prototype.stepBuddy = function (dt) {
    const B = this.buddy;
    if (!B) return;
    B.t += dt;
    const next = (st) => { B.state = st; B.t = 0; };
    switch (B.state) {
      case 'enter': if (B.t > 0.5) next('hello'); break;
      case 'hello': if (B.t > 1.5) { next('give'); this.gift(); } break;
      case 'give':
        if (B.t > 0.6) {
          next('freeze');
          const b = this.ball;
          if (this.o.sabotage !== 'noFreeze') b.frozenT = Math.min(12, Math.max(0, b.frozenT) + FREEZE);
          this.events.push({ type: 'freeze', who: B.id, x: B.x, y: B.y, bx: b.x, by: b.y, secs: b.frozenT });
        }
        break;
      case 'freeze': if (B.t > 0.8) next('stay'); break;
      case 'stay':
        if (B.queued > 0) { B.queued--; next('give'); this.gift(); }
        else if (B.t > 2.2 || this.state !== 'play') { next('leave'); this.events.push({ type: 'buddyOut', who: B.id }); }
        break;
      case 'leave':
        if (B.t > 0.6) this.buddy = null;
        break;
    }
  };

  // ---------------------------------------------------------------- the autopilot (the title demo, the soak)
  // Walks the edge to a launch point away from the ball, builds a little box out into the field and comes back;
  // rolls back or hurries home when the ball comes close.
  function Bot(sim, p, seed) {
    this.sim = sim;
    this.p = p;
    this.plan = [];
    this.launch = null;
    this.waitT = 0;
    this.rng = mulberry(seed || (p.n + 1) * 7919);
  }
  const key = (c) => c[0] + ',' + c[1];
  const dirTo = (a, b) => { for (let d = 0; d < 4; d++) if (a[0] + DIRS[d][0] === b[0] && a[1] + DIRS[d][1] === b[1]) return d; return -1; };

  Bot.prototype.input = function () {
    const s = this.sim, p = this.p;
    if (s.state !== 'play' || p.oopsT > 0) { this.plan = []; return {}; }
    const moving = p.ti >= 0;
    const at = moving ? [p.ti, p.tj] : [p.i, p.j];
    if (moving && p.kind === 'close') { this.plan = []; return {}; }
    const building = p.mode === 'build' || (moving && p.kind === 'build');
    if (building) {
      if (this.threat(at)) this.plan = this.escape(at);
      if (!this.plan.length) this.plan = this.home(at);
    } else if (!this.plan.length) {
      if (this.launch && key(this.launch.cell) === key(at)) {
        if (moving) return {};
        const b = s.ball, far = Math.hypot(b.x - at[0] - 0.5, b.y - at[1] - 0.5);
        if (far > 7 || b.frozenT > 1.5) { this.plan = this.boxPlan(at, this.launch.out); this.launch = null; }
        else if ((this.waitT += 1 / 120) > 1.2) { this.launch = null; this.waitT = 0; }
        if (!this.plan.length) return {};
      } else {
        this.pickLaunch(at);
      }
    }
    while (this.plan.length && key(this.plan[0]) === key(at)) this.plan.shift();
    if (!this.plan.length) return {};
    const d = dirTo(at, this.plan[0]);
    if (d < 0) { this.plan = []; return {}; }
    if (!moving && !s.moveKind(p, d, true)) { this.plan = []; return {}; }
    return { dir: d, build: true };
  };

  Bot.prototype.threat = function (at) {
    const s = this.sim, b = s.ball;
    if (b.frozenT > 0.6) return false;
    const near = (i, j, r) => Math.hypot(b.x - i - 0.5, b.y - j - 0.5) < r;
    if (near(at[0], at[1], 3.2)) return true;
    for (let k = 1; k < this.p.path.length; k++) if (near(this.p.path[k][0], this.p.path[k][1], 2.2)) return true;
    return false;
  };

  // the faster way out of danger: finish the fence, or roll it back up
  Bot.prototype.escape = function (at) {
    const home = this.home(at, true);
    const back = this.p.path.slice(0, -1).reverse();
    return home.length && home.length <= back.length ? home : back;
  };

  // the shortest way through the open field to claimed land (not by rolling back to where the fence started)
  Bot.prototype.home = function (at, quick) {
    const s = this.sim, p = this.p;
    const back = p.path[p.path.length - 2], prev = new Map(), q = [at];
    prev.set(key(at), null);
    for (let h = 0; h < q.length; h++) {
      const c = q[h];
      for (let d = 0; d < 4; d++) {
        const n = [c[0] + DIRS[d][0], c[1] + DIRS[d][1]];
        if (!inb(n[0], n[1]) || prev.has(key(n))) continue;
        if (h === 0 && back && key(n) === key(back)) continue;
        const k = idx(n[0], n[1]);
        if (s.cl[k]) {
          const out = [n];
          for (let x = c; x && key(x) !== key(at); x = prev.get(key(x))) out.unshift(x);
          return out;
        }
        if (s.fence[k] >= 0 || s.ballBlocks(n[0], n[1])) continue;
        prev.set(key(n), c);
        q.push(n);
      }
    }
    return quick ? [] : p.path.slice(0, -1).reverse();
  };

  // out k steps, then along m steps (the home path finishes it)
  Bot.prototype.boxPlan = function (at, out) {
    const s = this.sim, r = this.rng;
    const k = 2 + Math.floor(r() * 5), m = 4 + Math.floor(r() * 9);
    const side = (out + (r() < 0.5 ? 1 : 3)) % 4;
    const plan = [];
    let c = at;
    const go = (d, n) => {
      for (let t = 0; t < n; t++) {
        const nx = [c[0] + DIRS[d][0], c[1] + DIRS[d][1]];
        if (!inb(nx[0], nx[1]) || s.fence[idx(nx[0], nx[1])] >= 0) return false;
        plan.push(nx);
        c = nx;
        if (s.cl[idx(nx[0], nx[1])]) return false;
      }
      return true;
    };
    if (go(out, k)) go(side, m);
    if (plan.length && s.cl[idx(plan[plan.length - 1][0], plan[plan.length - 1][1])] && plan.length === 1) return [];
    return plan;
  };

  // a launch point on the edge, away from the ball, and the way there along the edge
  Bot.prototype.pickLaunch = function (at) {
    const s = this.sim, b = s.ball;
    const prev = new Map(), q = [at], cands = [];
    prev.set(key(at), null);
    for (let h = 0; h < q.length && q.length < 2000; h++) {
      const c = q[h];
      for (let d = 0; d < 4; d++) {
        const n = [c[0] + DIRS[d][0], c[1] + DIRS[d][1]];
        if (!inb(n[0], n[1])) continue;
        const k = idx(n[0], n[1]);
        if (!s.cl[k] && s.fence[k] < 0 && Math.hypot(b.x - n[0] - 0.5, b.y - n[1] - 0.5) > 6) cands.push({ cell: c, out: d, dist: h });
        if (!prev.has(key(n)) && s.isEdge(n[0], n[1])) { prev.set(key(n), c); q.push(n); }
      }
    }
    if (!cands.length) { this.plan = []; return; }
    const r = this.rng();
    const pick = cands[Math.floor(r * r * Math.min(cands.length, 50))] || cands[0];
    this.launch = pick;
    this.waitT = 0;
    const out = [];
    for (let x = pick.cell; x && key(x) !== key(at); x = prev.get(key(x))) out.unshift(x);
    this.plan = out;
  };

  // ---------------------------------------------------------------- fixed-step runner
  // o.rawDt (only for the checks' broken-rule run) steps by the frame time instead
  function Runner(sim, o = {}) { this.sim = sim; this.acc = 0; this.steps = 0; this.o = o; }
  Runner.prototype.advance = function (frameDt, inputFn) {
    if (this.o.rawDt) { this.sim.step(frameDt, inputFn ? inputFn(this.sim) : {}); this.steps++; return 1; }
    this.acc += frameDt;
    let n = 0;
    while (this.acc >= DT - 1e-9 && n < 8) {
      this.sim.step(DT, inputFn ? inputFn(this.sim) : {});
      this.acc -= DT;
      n++;
      this.steps++;
    }
    if (this.acc > DT) this.acc = 0;
    return n;
  };

  Object.assign(FB, { DT, GW, GH, DIRS, BALL_R, BODY_R, BUG_HIT, CLEAR_T, FREEZE, HI5_FREEZE, HI5_CD, TREATS, LEVELS, DIFF, Sim, Bot, Runner, mulberry, clamp, idx, inb, circleCell });
})(typeof window !== 'undefined' ? window : globalThis);
