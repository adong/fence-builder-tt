/* TT Fence Builder: the Three.js scene. A fixed arcade camera looks down at the field at a tilt (the far edge at the
   top of the screen, the near edge at the bottom). The field is one plane with a canvas texture (js/art.js): the hidden
   picture where the land is claimed, a sandy meadow where it's open. On it: the builders (the kit's kids, with a toy
   mallet), their fences (instanced posts and rails), the beach ball, the sparkly bugs, the brother who comes to help,
   and effects (flowers popping up in new garden, confetti, floating words). Exposes FB.View. Rules: js/sim.js. */
(function () {
  'use strict';
  const T = THREE, G = Kit.gfx, FB = window.FB, A = FB.art;
  const { GW, GH } = FB;
  const KID_S = 0.95;                // the kids' size (they're about 2 m tall; a cell is 1 m: chunky toys)
  const BALL_VIS = 0.8;              // the beach ball as drawn, big and squishy (the rules use FB.BALL_R)
  const PITCH = 56;                  // the camera looks down this many degrees
  const SIG_T = 2.4;                 // Teddy switches between boxing and the jump shot this often
  const BOX = { x0: -GW / 2 - 1.1, x1: GW / 2 + 1.1, z0: -GH / 2 - 1.1, z1: GH / 2 + 1.1, y1: 2.2 };
  const TINT = { teddy: '#3d9bff', tommy: '#2fd6a2' };
  const SLOW_TINT = '#ffb52e';
  const YAW = [0, -Math.PI / 2, Math.PI, Math.PI / 2]; // facing up, right, down, left (the kit's people face -z)

  const wx = (x) => x - GW / 2;      // cell units -> world
  const wz = (y) => y - GH / 2;
  const v3 = (x, y, z) => new T.Vector3(x, y, z);
  const mat = (c, o = {}) => new T.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.55 }, o));

  function sprite(tex, w, h = w, o = {}) {
    const s = new T.Sprite(new T.SpriteMaterial(Object.assign({ map: tex, transparent: true, depthWrite: false }, o)));
    s.scale.set(w, h, 1);
    return s;
  }

  // one geometry from a few simple parts (for the fence posts)
  function merge(parts) {
    const list = parts.map(([g, m]) => { const n = g.index ? g.toNonIndexed() : g.clone(); n.applyMatrix4(m); return n; });
    let n = 0;
    for (const g of list) n += g.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
    let o = 0;
    for (const g of list) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count; }
    const out = new T.BufferGeometry();
    out.setAttribute('position', new T.BufferAttribute(pos, 3));
    out.setAttribute('normal', new T.BufferAttribute(nor, 3));
    out.computeBoundingSphere();
    return out;
  }

  function View(canvas) {
    const r = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    r.outputEncoding = T.sRGBEncoding;
    r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    r.shadowMap.enabled = true;
    r.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer = r;
    this.canvas = canvas;
    this.scene = new T.Scene();
    this.scene.background = new T.Color('#9be27a');
    this.camera = new T.PerspectiveCamera(30, 1, 1, 500);
    this.scene.add(new T.HemisphereLight('#ffffff', '#7a9a5a', 0.95));
    const sun = new T.DirectionalLight('#fff4e2', 0.95);
    sun.position.set(-12, 30, 14);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 22, bottom: -22, near: 1, far: 90 });
    sun.shadow.bias = -0.0008;
    this.scene.add(sun, sun.target);
    this.margins = { top: 64, bottom: 8, left: 58, right: 8 };
    this.size = [0, 0];
    this.t = 0;
    this.shake = 0;
    this.kids = new Map();
    this.bugs = new Map();
    this.fx = [];
    this.births = new Map();
    this.m4 = new T.Matrix4();
    this.q = new T.Quaternion();
    this.col = new T.Color();
    this.sim = null;
    this.reveal = -1;
    this.buildStage();
  }

  // ---------------------------------------------------------------- the stage (built once)
  View.prototype.buildStage = function () {
    const S = this.scene;
    const ground = new T.Mesh(new T.PlaneGeometry(260, 260), new T.MeshLambertMaterial({ color: '#86d266' }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.06;
    ground.receiveShadow = true;
    S.add(ground);
    this.fieldTex = new A.FieldTexture();
    const field = new T.Mesh(new T.PlaneGeometry(GW, GH), new T.MeshLambertMaterial({ map: this.fieldTex.tex }));
    field.rotation.x = -Math.PI / 2;
    field.receiveShadow = true;
    S.add(field);
    this.field = field;
    // a chunky toy frame around the field: wooden rails and bright corner blocks
    const wood = mat('#e9a861'), woodTop = mat('#ffd08a');
    const rail = (w, d, x, z) => {
      const m = new T.Mesh(new T.BoxGeometry(w, 0.42, d), wood);
      m.position.set(x, 0.17, z);
      m.castShadow = m.receiveShadow = true;
      const top = new T.Mesh(new T.BoxGeometry(w, 0.06, d * 0.6), woodTop);
      top.position.y = 0.23;
      m.add(top);
      S.add(m);
    };
    rail(GW + 1.4, 0.7, 0, -GH / 2 - 0.35);
    rail(GW + 1.4, 0.7, 0, GH / 2 + 0.35);
    rail(0.7, GH, -GW / 2 - 0.35, 0);
    rail(0.7, GH, GW / 2 + 0.35, 0);
    const cols = ['#ff7ab8', '#ffd23f', '#4fd8ff', '#8cff6b'];
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sz], k) => {
      const b = new T.Mesh(new T.BoxGeometry(1.0, 0.8, 1.0), mat(cols[k], { roughness: 0.4 }));
      b.position.set(sx * (GW / 2 + 0.35), 0.38, sz * (GH / 2 + 0.35));
      b.castShadow = true;
      S.add(b);
    });
    // trees, bushes and flowers around the outside
    const rng = FB.mulberry(77);
    const trunk = mat('#9a6a3a'), leaves = [mat('#3fae4a'), mat('#5ccd52'), mat('#2f9a48')];
    const ball = new T.SphereGeometry(1, 14, 10);
    const tree = (x, z, s) => {
      const g = new T.Group();
      const t = new T.Mesh(new T.CylinderGeometry(0.18, 0.24, 1.2, 8), trunk);
      t.position.y = 0.6;
      g.add(t);
      for (const [dx, dy, dz, r] of [[0, 1.6, 0, 0.9], [0.5, 1.3, 0.2, 0.6], [-0.45, 1.35, -0.1, 0.65]]) {
        const l = new T.Mesh(ball, leaves[Math.floor(rng() * 3)]);
        l.position.set(dx, dy, dz);
        l.scale.setScalar(r);
        g.add(l);
      }
      g.traverse((n) => { if (n.isMesh) n.castShadow = true; });
      g.position.set(x, 0, z);
      g.scale.setScalar(s);
      S.add(g);
    };
    for (let k = 0; k < 16; k++) tree(-GW / 2 + 1 + (k / 15) * (GW - 2) + (rng() - 0.5) * 1.5, -GH / 2 - 2.2 - rng() * 2.5, 0.9 + rng() * 0.5);
    for (let k = 0; k < 8; k++) for (const sx of [-1, 1]) tree(sx * (GW / 2 + 2.2 + rng() * 3), -GH / 2 + (k / 7) * GH, 0.8 + rng() * 0.5);
    const fl = ['#ffffff', '#ffe14a', '#ff8fc8', '#b48cff', '#ff6b6b'];
    const petal = new T.SphereGeometry(0.16, 8, 6);
    for (let k = 0; k < 70; k++) {
      const side = k % 4;
      const x = side < 2 ? (rng() - 0.5) * (GW + 6) : (side === 2 ? -1 : 1) * (GW / 2 + 1.2 + rng() * 2);
      const z = side < 2 ? (side === 0 ? -1 : 1) * (GH / 2 + 1.1 + rng() * 1.6) : (rng() - 0.5) * GH;
      const f = new T.Mesh(petal, mat(fl[k % fl.length]));
      f.position.set(x, 0.1, z);
      S.add(f);
    }
    // the fences: white posts with pointy tops, coloured rails (instanced; filled from the rules every frame)
    const postGeo = merge([[new T.BoxGeometry(0.17, 0.6, 0.17), new T.Matrix4().makeTranslation(0, 0.3, 0)], [new T.ConeGeometry(0.13, 0.2, 4), new T.Matrix4().compose(v3(0, 0.7, 0), new T.Quaternion().setFromEuler(new T.Euler(0, Math.PI / 4, 0)), v3(1, 1, 1))]]);
    this.posts = new T.InstancedMesh(postGeo, mat('#ffffff', { roughness: 0.4 }), GW * GH);
    this.rails = new T.InstancedMesh(new T.BoxGeometry(1.02, 0.1, 0.08), mat('#ffffff', { roughness: 0.45 }), GW * GH * 2 + 8);
    for (const m of [this.posts, this.rails]) {
      m.castShadow = true;
      m.count = 0;
      m.frustumCulled = false;
      for (let k = 0; k < m.instanceMatrix.count; k++) m.setColorAt(k, this.col.set('#ffffff'));
      S.add(m);
    }
    this.buildBall();
  };

  // ---------------------------------------------------------------- the beach ball
  View.prototype.buildBall = function () {
    const g = new T.Group();
    const m = new T.Mesh(new T.SphereGeometry(BALL_VIS, 32, 20), new T.MeshStandardMaterial({ map: A.ballTexture(), roughness: 0.3, emissive: '#6fd4ff', emissiveIntensity: 0 }));
    m.castShadow = true;
    const spin = new T.Group();
    spin.add(m);
    const ice = new T.Mesh(new T.SphereGeometry(BALL_VIS * 1.16, 24, 16), new T.MeshStandardMaterial({ color: '#bff0ff', transparent: true, opacity: 0.45, roughness: 0.1, depthWrite: false }));
    ice.visible = false;
    const lift = new T.Group();
    lift.add(spin, ice);
    const shadow = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: A.shadowTexture(), transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;
    const flakes = [];
    for (let k = 0; k < 5; k++) {
      const f = sprite(A.flakeTexture(), 0.32);
      f.visible = false;
      g.add(f);
      flakes.push(f);
    }
    g.add(lift, shadow);
    this.scene.add(g);
    this.ball = { root: g, lift, spin, mesh: m, ice, shadow, flakes, hop: 0, squash: 0, lastX: 0, lastY: 0 };
  };

  View.prototype.syncBall = function (sim, dt) {
    const v = this.ball, b = sim.ball;
    const x = wx(b.x), z = wz(b.y);
    v.root.position.set(x, 0, z);
    const frozen = b.frozenT > 0, moving = !frozen && b.waitT <= 0 && sim.state === 'play';
    if (moving) {
      v.hop += dt * 5.2;
      const dx = x - v.lastX, dz = z - v.lastY, d = Math.hypot(dx, dz);
      if (d > 1e-6 && d < 2) v.spin.rotateOnWorldAxis(v3(dz / d, 0, -dx / d), d / BALL_VIS);
    }
    v.lastX = x;
    v.lastY = z;
    const h = Math.abs(Math.sin(v.hop));
    v.squash = Math.max(0, v.squash - dt * 6);
    const sq = h < 0.15 ? (0.15 - h) * 1.6 : 0;
    v.lift.position.y = BALL_VIS * (1 - sq * 0.5) + h * 0.55;
    v.lift.scale.set(1 + sq * 0.6, 1 - sq, 1 + sq * 0.6);
    const s = 1.15 - h * 0.35;
    v.shadow.scale.set(s, s, 1);
    v.mesh.material.emissiveIntensity = frozen ? 0.55 : 0;
    v.ice.visible = frozen;
    v.flakes.forEach((f, k) => {
      f.visible = frozen;
      if (!frozen) return;
      const a = this.t * 1.5 + (k * Math.PI * 2) / 5;
      f.position.set(Math.cos(a) * 0.95, v.lift.position.y + Math.sin(this.t * 3 + k) * 0.35, Math.sin(a) * 0.95);
      f.material.rotation = this.t * 2 + k;
    });
  };

  // ---------------------------------------------------------------- the kids
  View.prototype.makeKid = function (id, scale, tagged) {
    const entry = Kit.roster.get(id);
    const root = new T.Group();
    const p = Kit.people.build(entry.look);
    p.root.scale.setScalar(scale);
    root.add(p.root);
    // a toy mallet in his right hand
    const mallet = new T.Group();
    const handle = new T.Mesh(new T.BoxGeometry(0.07, 0.42, 0.07), mat('#a86d3a'));
    handle.position.y = -0.18;
    const head = new T.Mesh(new T.BoxGeometry(0.34, 0.18, 0.18), mat('#ff5a5a', { roughness: 0.35 }));
    head.position.y = -0.4;
    mallet.add(handle, head);
    mallet.position.set(0, -0.68, 0.05);
    mallet.rotation.x = -Math.PI / 2;
    p.armR.add(mallet);
    root.traverse((n) => { if (n.isMesh) n.castShadow = true; });
    // a coloured ring under his feet, so a kid can find himself
    const ring = new T.Mesh(new T.RingGeometry(0.5, 0.68, 28), new T.MeshBasicMaterial({ color: TINT[id], transparent: true, opacity: 0.85, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    root.add(ring);
    const dizzy = sprite(G.emojiTexture('💫'), 0.9);
    dizzy.visible = false;
    root.add(dizzy);
    let tag = null;
    if (tagged) {
      tag = G.nameTag(entry.name, entry.tag);
      tag.scale.multiplyScalar(0.7);
      root.add(tag);
    }
    this.scene.add(root);
    return { root, p, mallet, ring, dizzy, tag, entry, scale, ph: 0, celebT: 0, ballT: 0, yaw: Math.PI, pop: tagged ? 0 : 1 };
  };

  View.prototype.signatureLift = function (v, mode, x, z, dt) {
    if (mode === 'jumpshot') {
      const c = (this.t * 1.1) % 1;
      v.ballT -= dt;
      if (c > 0.3 && v.ballT <= 0) { v.ballT = 0.85; this.emojiFly('🏀', x + 0.2, 1.5, z, x + (x < 0 ? 3 : -3), 5, z - 2, 0.9, 1.6); }
      return Math.sin(Math.min(1, c / 0.6) * Math.PI) * 0.35;
    }
    if (mode === 'peace' || mode === 'cheer') return Math.abs(Math.sin(this.t * 4)) * 0.15;
    return 0;
  };

  View.prototype.syncKid = function (v, q, sim, dt) {
    const k = 1 - Math.exp(-16 * dt);
    const at = sim.pos(q);
    const x = wx(at.x), z = wz(at.y);
    const moving = q.ti >= 0;
    let mode = 'stand', faceCam = false;
    if (sim.state === 'clear' || sim.state === 'done') {
      v.celebT += dt;
      const sig = v.entry.signature || ['wave'];
      mode = sig[Math.floor(v.celebT / SIG_T) % sig.length];
      faceCam = true;
    } else {
      v.celebT = 0;
      if (q.oopsT > 0 || sim.state === 'over') { mode = 'oops'; faceCam = true; }
      else if (q.hi5T > 0) { mode = 'cheer'; faceCam = true; }
      else if (q.mode === 'build' || q.kind === 'build') mode = 'hammer';
      else if (moving) mode = 'walk';
    }
    const lift = this.signatureLift(v, mode, x, z, dt);
    v.ph += dt * (moving ? 11 : mode === 'boxing' ? 7.5 : 6);
    FB.pose(v.p, v.ph, mode, k, { moving });
    v.root.position.set(x, lift, z);
    const want = faceCam ? Math.PI : YAW[q.face];
    let d = want - v.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    v.yaw += d * Math.min(1, dt * 14);
    v.p.root.rotation.y = v.yaw;
    v.mallet.visible = mode === 'hammer';
    v.ring.position.y = 0.03 - lift;
    v.root.visible = !(q.inv > 0 && q.oopsT <= 0 && Math.floor(this.t * 12) % 2 === 0);
    v.dizzy.visible = mode === 'oops';
    if (v.dizzy.visible) { v.dizzy.position.set(Math.sin(this.t * 7) * 0.12, 2.2, 0); v.dizzy.material.rotation = this.t * 3; }
  };

  View.prototype.syncBuddy = function (sim, dt) {
    const B = sim.buddy;
    let v = this.kids.get('buddy');
    if (!B) { if (v) { this.scene.remove(v.root); this.kids.delete('buddy'); } return; }
    if (!v || v.entry.id !== B.id) {
      if (v) this.scene.remove(v.root);
      v = this.makeKid(B.id, KID_S * (Kit.roster.get(B.id).buddyScale || 0.8), true);
      this.kids.set('buddy', v);
    }
    const k = 1 - Math.exp(-16 * dt);
    const st = B.state;
    let mode = 'stand';
    if (st === 'enter' || st === 'hello') mode = Kit.roster.signature(v.entry, 'hello');
    else if (st === 'leave') mode = Kit.roster.signature(v.entry, 'goodbye');
    else if (st === 'give') mode = 'give';
    else if (st === 'freeze') mode = 'point';
    else mode = 'wave';
    const x = wx(B.x), z = wz(B.y);
    const lift = this.signatureLift(v, mode, x, z, dt);
    v.ph += dt * (mode === 'boxing' ? 7.5 : 6);
    FB.pose(v.p, v.ph, mode, k, {});
    v.pop += ((st === 'leave' ? 0 : 1) - v.pop) * Math.min(1, dt * 7);
    const s = Math.max(0.001, v.pop * (1 + (st === 'enter' ? Math.sin(Math.min(1, B.t * 2) * Math.PI) * 0.25 : 0)));
    v.root.scale.setScalar(s);
    v.root.position.set(x, lift, z);
    // he faces the camera, and turns to the ball to freeze it
    const b = sim.ball;
    const want = st === 'freeze' ? Math.atan2(-(wx(b.x) - x), -(wz(b.y) - z)) : Math.PI;
    let d = want - v.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    v.yaw += d * Math.min(1, dt * 10);
    v.p.root.rotation.y = v.yaw;
    v.mallet.visible = false;
    v.ring.visible = false;
    v.tag.position.set(0, 2.05 * v.scale + 0.35, 0);
  };

  // ---------------------------------------------------------------- the sparkly bugs
  View.prototype.makeBug = function () {
    const root = new T.Group();
    const body = new T.Group();
    const shell = new T.Mesh(new T.SphereGeometry(0.3, 16, 12), mat('#b06bff', { roughness: 0.25, metalness: 0.1 }));
    shell.scale.set(1, 0.72, 1.2);
    const spot = new T.SphereGeometry(0.06, 8, 6), spotM = mat('#5a2a9a');
    for (const [x, z] of [[0.13, 0.05], [-0.13, 0.05], [0.1, -0.18], [-0.1, -0.18], [0, 0.22]]) {
      const s = new T.Mesh(spot, spotM);
      s.position.set(x, 0.2, z);
      s.scale.y = 0.5;
      body.add(s);
    }
    const head = new T.Mesh(new T.SphereGeometry(0.17, 12, 10), mat('#5a2a9a'));
    head.position.set(0, 0.04, -0.36);
    const eyeW = new T.SphereGeometry(0.075, 10, 8), eyeB = new T.SphereGeometry(0.038, 8, 6);
    for (const s of [-1, 1]) {
      const e = new T.Mesh(eyeW, mat('#ffffff', { roughness: 0.2 }));
      e.position.set(s * 0.08, 0.12, -0.46);
      const p = new T.Mesh(eyeB, mat('#14121f'));
      p.position.set(s * 0.08, 0.13, -0.53);
      const ant = new T.Mesh(new T.CylinderGeometry(0.015, 0.015, 0.26, 5), mat('#5a2a9a'));
      ant.position.set(s * 0.08, 0.27, -0.4);
      ant.rotation.z = -s * 0.35;
      const tip = new T.Mesh(new T.SphereGeometry(0.045, 8, 6), mat('#ffe14a', { emissive: '#ffb000', emissiveIntensity: 0.5 }));
      tip.position.set(s * 0.13, 0.39, -0.4);
      body.add(e, p, ant, tip);
    }
    const wings = [];
    for (const s of [-1, 1]) {
      const w = new T.Mesh(new T.CircleGeometry(0.26, 16), new T.MeshBasicMaterial({ color: '#e8f6ff', transparent: true, opacity: 0.6, side: T.DoubleSide, depthWrite: false }));
      w.scale.set(0.7, 1.2, 1);
      w.position.set(s * 0.18, 0.26, 0.05);
      w.rotation.x = -Math.PI / 2;
      body.add(w);
      wings.push(w);
    }
    body.add(shell, head);
    body.traverse((n) => { if (n.isMesh && n.geometry.type !== 'CircleGeometry') n.castShadow = true; });
    const sparks = [];
    for (let k = 0; k < 3; k++) {
      const s = sprite(A.sparkTexture(['#ffffff', '#fff3a0', '#ffc8ff'][k]), 0.28);
      root.add(s);
      sparks.push(s);
    }
    root.add(body);
    this.scene.add(root);
    return { root, body, wings, sparks, yaw: 0, ph: Math.random() * 6 };
  };

  View.prototype.syncBugs = function (sim, dt) {
    const seen = new Set();
    for (const g of sim.bugs) {
      seen.add(g.id);
      let v = this.bugs.get(g.id);
      if (!v) { v = this.makeBug(); this.bugs.set(g.id, v); }
      v.root.visible = g.goneT <= 0;
      if (!v.root.visible) continue;
      const at = sim.pos(g);
      v.ph += dt * 30;
      v.root.position.set(wx(at.x), 0.3 + Math.sin(this.t * 6 + g.id) * 0.08, wz(at.y));
      const dir = g.ti >= 0 ? FB.DIRS.findIndex(([a, b]) => a === g.ti - g.i && b === g.tj - g.j) : g.face;
      const want = YAW[dir < 0 ? g.face : dir];
      let d = want - v.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      v.yaw += d * Math.min(1, dt * 12);
      v.body.rotation.y = v.yaw;
      v.wings.forEach((w, k) => { w.rotation.y = (k ? -1 : 1) * Math.abs(Math.sin(v.ph)) * 0.8; });
      v.sparks.forEach((s, k) => {
        const a = this.t * 2.5 + (k * Math.PI * 2) / 3;
        s.position.set(Math.cos(a) * 0.45, 0.3 + Math.sin(this.t * 5 + k) * 0.15, Math.sin(a) * 0.45);
        s.material.opacity = 0.5 + 0.5 * Math.sin(this.t * 8 + k * 2);
        s.material.rotation = this.t * 3;
      });
    }
    for (const [id, v] of this.bugs) if (!seen.has(id)) { this.scene.remove(v.root); this.bugs.delete(id); }
  };

  // ---------------------------------------------------------------- the fences
  View.prototype.syncFences = function (sim) {
    let np = 0, nr = 0;
    const posts = this.posts, rails = this.rails;
    const live = new Set();
    for (const q of sim.players) {
      if (q.mode !== 'build') continue;
      const tint = q.slow ? SLOW_TINT : TINT[q.id];
      for (let k = 0; k < q.path.length; k++) {
        const [i, j] = q.path[k];
        const key = i + ',' + j;
        if (k > 0) {
          live.add(key);
          let born = this.births.get(key);
          if (born == null) { born = this.t; this.births.set(key, born); }
          const a = Math.min(1, (this.t - born) / 0.2);
          const sy = a < 1 ? Math.sin(a * Math.PI * 0.5) * (1 + (1 - a) * 0.4) : 1;
          this.m4.compose(v3(wx(i + 0.5), 0, wz(j + 0.5)), this.q.identity(), v3(1, Math.max(0.01, sy), 1));
          posts.setMatrixAt(np, this.m4);
          posts.setColorAt(np, this.col.set('#fffdf5'));
          np++;
        }
        if (k > 0) {
          const [pi, pj] = q.path[k - 1];
          const horiz = pj === j;
          this.q.setFromAxisAngle(v3(0, 1, 0), horiz ? 0 : Math.PI / 2);
          for (const h of [0.2, 0.44]) {
            this.m4.compose(v3(wx((i + pi) / 2 + 0.5), h, wz((j + pj) / 2 + 0.5)), this.q, v3(1, 1, 1));
            rails.setMatrixAt(nr, this.m4);
            rails.setColorAt(nr, this.col.set(tint));
            nr++;
          }
        }
      }
    }
    for (const key of this.births.keys()) if (!live.has(key)) this.births.delete(key);
    posts.count = np;
    rails.count = nr;
    posts.instanceMatrix.needsUpdate = rails.instanceMatrix.needsUpdate = true;
    if (posts.instanceColor) posts.instanceColor.needsUpdate = true;
    if (rails.instanceColor) rails.instanceColor.needsUpdate = true;
  };

  // ---------------------------------------------------------------- per frame
  View.prototype.setGame = function (sim) {
    this.sim = sim;
    for (const v of this.kids.values()) this.scene.remove(v.root);
    this.kids.clear();
    for (const v of this.bugs.values()) this.scene.remove(v.root);
    this.bugs.clear();
    for (const f of this.fx) this.scene.remove(f.obj);
    this.fx = [];
    this.births.clear();
    this.reveal = -1;
    this.drawField(sim);
  };

  View.prototype.drawField = function (sim) {
    this.fieldTex.draw(sim, Math.max(0, this.reveal));
    this.prevCl = sim.cl.slice();
    this.drawnLevel = sim.level;
  };

  View.prototype.update = function (sim, dt) {
    if (!sim) return;
    if (sim !== this.sim) this.setGame(sim);
    this.t += dt;
    if (this.drawnLevel !== sim.level) { this.reveal = -1; this.drawField(sim); }
    if (this.reveal >= 0 && this.reveal < 1) { this.reveal = Math.min(1, this.reveal + dt * 0.9); this.fieldTex.draw(sim, this.reveal); }
    for (const q of sim.players) {
      let v = this.kids.get(q.id);
      if (!v) { v = this.makeKid(q.id, KID_S, false); this.kids.set(q.id, v); }
      this.syncKid(v, q, sim, dt);
    }
    this.syncBuddy(sim, dt);
    this.syncBall(sim, dt);
    this.syncBugs(sim, dt);
    this.syncFences(sim);
    this.updateFx(dt);
    this.shake = Math.max(0, this.shake - dt * 2);
    this.fit();
    if (this.shake > 0) {
      const s = this.shake * 0.25;
      this.camera.position.x = this.camPos.x + Math.sin(this.t * 60) * s;
      this.camera.position.z = this.camPos.z + Math.cos(this.t * 53) * s;
    } else if (this.camPos) this.camera.position.copy(this.camPos);
  };

  // ---------------------------------------------------------------- effects
  View.prototype.particle = function (o) {
    const s = sprite(o.map || G.dotTexture(), o.size, o.size, { color: o.color || '#ffffff' });
    s.position.set(o.x, o.y, o.z);
    this.scene.add(s);
    this.fx.push({ obj: s, vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0, grav: o.grav ?? 6, life: o.life || 1, max: o.life || 1, size: o.size, grow: o.grow || 0, spin: o.spin || 0, fade: o.fade !== false });
  };

  View.prototype.burst = function (x, y, z, color, n, speed, size, o = {}) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, sp = speed * (0.4 + Math.random() * 0.6);
      this.particle({ x, y, z, vx: Math.cos(a) * sp, vy: (o.up ?? 2) + Math.random() * 2, vz: Math.sin(a) * sp, size, color, life: 0.6 + Math.random() * 0.4, grav: o.grav ?? 8 });
    }
  };

  View.prototype.popup = function (text, x, z, color, big) {
    const s = sprite(A.textTexture(Kit.lang.t(text), color || '#ffffff'), 1, 1);
    s.position.set(x, 1.8, z);
    s.renderOrder = 5;
    this.scene.add(s);
    const w = big ? 6 : 3.2;
    this.fx.push({ obj: s, vx: 0, vy: big ? 0.8 : 1.3, vz: 0, life: big ? 1.4 : 0.9, max: big ? 1.4 : 0.9, size: w, grow: 0.12, grav: 0, spin: 0, fade: true, sx: 1, sy: 0.25 });
  };

  View.prototype.emojiFly = function (emoji, x0, y0, z0, x1, y1, z1, time, arc) {
    const s = sprite(G.emojiTexture(emoji), 1);
    s.position.set(x0, y0, z0);
    this.scene.add(s);
    this.fx.push({ obj: s, life: time, max: time, size: 0.9, grow: 0.2, fade: false, path: { x0, y0, z0, x1, y1, z1, arc: arc ?? 2 } });
  };

  View.prototype.confetti = function (n, x = 0, z = 0, spread = GW) {
    const cols = ['#ff4b4b', '#ffd93b', '#3d8bff', '#2fd6b0', '#a066e8', '#ffffff', '#ff7ab8'];
    for (let k = 0; k < n; k++) {
      this.particle({ x: x + (Math.random() - 0.5) * spread, y: 4 + Math.random() * 5, z: z + (Math.random() - 0.5) * spread * 0.6, vx: (Math.random() - 0.5) * 2, vy: -1 - Math.random() * 2, vz: (Math.random() - 0.5) * 2,
        life: 2.6 + Math.random() * 1.5, size: 0.4, color: cols[k % cols.length], spin: (Math.random() - 0.5) * 10, map: squareTexture(), grav: 1.5 });
    }
  };

  let squareTex = null;
  function squareTexture() {
    if (squareTex) return squareTex;
    const [c, g] = G.makeCanvas(16, 16);
    g.fillStyle = '#fff';
    g.fillRect(2, 4, 12, 8);
    return (squareTex = G.toTexture(c));
  }

  View.prototype.updateFx = function (dt) {
    for (const f of this.fx) {
      f.life -= dt;
      const o = f.obj;
      if (f.path) {
        const u = 1 - Math.max(0, f.life) / f.max, P = f.path;
        o.position.set(P.x0 + (P.x1 - P.x0) * u, P.y0 + (P.y1 - P.y0) * u + Math.sin(u * Math.PI) * P.arc, P.z0 + (P.z1 - P.z0) * u);
        if (o.material) o.material.rotation += dt * 6;
      } else {
        f.vy -= (f.grav || 0) * dt;
        o.position.x += (f.vx || 0) * dt;
        o.position.y += f.vy * dt;
        o.position.z += (f.vz || 0) * dt;
        if (f.spin && o.material) o.material.rotation += f.spin * dt;
      }
      const sz = f.size * (1 + (f.grow || 0) * (1 - f.life / f.max));
      if (f.mesh) o.scale.setScalar(sz);
      else o.scale.set(sz * (f.sx || 1), sz * (f.sy || 1), 1);
      if (f.fade && o.material) o.material.opacity = Math.max(0, Math.min(1, f.life / (f.max * 0.4)));
      if (f.life <= 0) { this.scene.remove(o); if (o.material) o.material.dispose(); f.dead = true; }
    }
    this.fx = this.fx.filter((f) => !f.dead);
  };

  // flowers spring up across the new garden
  View.prototype.sprout = function (sim) {
    const prev = this.prevCl, fresh = [];
    if (prev) for (let k = 0; k < sim.cl.length; k++) if (sim.cl[k] && !prev[k]) fresh.push(k);
    const pick = ['🌼', '🌷', '🌸', '🌻', '🍀'];
    const n = Math.min(26, Math.ceil(fresh.length / 6));
    for (let m = 0; m < n; m++) {
      const k = fresh[Math.floor(Math.random() * fresh.length)];
      const i = k % GW, j = (k - i) / GW;
      const s = sprite(G.emojiTexture(pick[m % pick.length]), 0.8);
      s.position.set(wx(i + 0.5), 0.3, wz(j + 0.5));
      this.scene.add(s);
      this.fx.push({ obj: s, vx: 0, vy: 1.6 + Math.random(), vz: 0, grav: 3, life: 1.1, max: 1.1, size: 0.75, grow: 0.3, fade: true });
    }
  };

  // what happened in the rules this step
  View.prototype.onEvent = function (ev, sim) {
    const tx = (x) => wx(x), tz = (y) => wz(y);
    switch (ev.type) {
      case 'level': this.reveal = -1; this.drawField(sim); break;
      case 'claim':
        this.sprout(sim);
        this.drawField(sim);
        this.popup('+' + ev.pts, tx(ev.x), tz(ev.y), ev.slow ? '#ffb52e' : '#ffe14a', ev.cells > 120);
        this.burst(tx(ev.x), 0.6, tz(ev.y), '#ffffff', 14, 3, 0.25);
        break;
      case 'post': this.burst(wx(ev.i + 0.5), 0.2, wz(ev.j + 0.5), '#e8c98f', 3, 1.2, 0.18, { up: 1, grav: 6 }); break;
      case 'snap': {
        // the posts boing back to where the fence started
        for (const [i, j] of ev.cells || []) this.emojiFly('💥', wx(i + 0.5), 0.5, wz(j + 0.5), wx(ev.si + 0.5), 0.8, wz(ev.sj + 0.5), 0.35, 0.6);
        this.popup('BOING!', tx(ev.x), tz(ev.y), '#ff9ad5', false);
        if (ev.lost) this.shake = 0.4;
        break;
      }
      case 'bounce': this.ball.squash = 1; break;
      case 'bugPop': {
        const x = tx(ev.x), z = tz(ev.y);
        this.burst(x, 0.5, z, '#d9a8ff', 16, 3, 0.25, { up: 2, grav: 3 });
        this.confetti(18, x, z, 2);
        this.popup('ACHOO!', x, z, '#d9a8ff');
        const v = this.bugs.get(ev.id);
        if (v) {
          // a puffed-up copy floats away
          const ghost = v.root.clone();
          ghost.position.copy(v.root.position);
          this.scene.add(ghost);
          this.fx.push({ obj: ghost, vx: 0, vy: 2.2, vz: -0.6, grav: 0, life: 1.6, max: 1.6, size: 1, grow: 0.6, spin: 0, fade: false, mesh: true });
        }
        break;
      }
      case 'gift': this.emojiFly(ev.emoji, tx(ev.x), 1.4, tz(ev.y), tx(ev.tx), 1.2, tz(ev.ty), 0.8, 2.2); break;
      case 'freeze': {
        // a trail of sparkles from the brother's hand to the ball
        const x0 = tx(ev.x), z0 = tz(ev.y), x1 = tx(ev.bx), z1 = tz(ev.by);
        for (let k = 0; k < 14; k++) {
          const u = k / 13;
          this.particle({ x: x0 + (x1 - x0) * u, y: 1 + Math.sin(u * Math.PI) * 1.2, z: z0 + (z1 - z0) * u, vx: 0, vy: 0.3, vz: 0, grav: 0, size: 0.4, map: A.sparkTexture('#bff0ff'), life: 0.5 + u * 0.5 });
        }
        this.burst(x1, 1, z1, '#ffffff', 18, 3, 0.25, { up: 1, grav: 2 });
        this.popup('BRRR!', x1, z1, '#bff0ff');
        break;
      }
      case 'thaw': this.burst(wx(sim.ball.x), 0.8, wz(sim.ball.y), '#dff6ff', 12, 2.5, 0.2); break;
      case 'highfive': {
        const s = sprite(G.emojiTexture('✋'), 1.6);
        s.position.set(tx(ev.x), 2.5, tz(ev.y));
        this.scene.add(s);
        this.fx.push({ obj: s, vx: 0, vy: 0.8, vz: 0, life: 1.4, max: 1.4, size: 1.6, grow: 0.6, grav: 0, spin: 0, fade: true });
        this.confetti(40, tx(ev.x), tz(ev.y), 8);
        break;
      }
      case 'clear': this.reveal = 0; this.confetti(ev.last ? 160 : 90); break;
      case 'done': this.confetti(140); break;
      case 'oops': this.shake = Math.max(this.shake, 0.3); break;
    }
  };

  // ---------------------------------------------------------------- the camera
  // Frame the whole field (and the kids at its far edge) in the space the HUD and the touch controls leave.
  View.prototype.fit = function (force) {
    const c = this.canvas, w = c.clientWidth || window.innerWidth, h = c.clientHeight || window.innerHeight;
    const key = JSON.stringify(this.margins);
    if (!force && w === this.size[0] && h === this.size[1] && this.marginKey === key) return;
    this.size = [w, h];
    this.marginKey = key;
    this.renderer.setSize(w, h, false);
    const cam = this.camera, mg = this.margins;
    const availW = Math.max(80, w - mg.left - mg.right), availH = Math.max(80, h - mg.top - mg.bottom);
    cam.aspect = w / h;
    cam.clearViewOffset();
    const pitch = T.MathUtils.degToRad(PITCH);
    const dir = v3(0, Math.sin(pitch), Math.cos(pitch));
    const corners = [];
    for (const x of [BOX.x0, BOX.x1]) for (const z of [BOX.z0, BOX.z1]) for (const y of [0, BOX.y1]) corners.push(v3(x, y, z));
    const p = new T.Vector3();
    const measure = (d) => {
      cam.position.copy(dir).multiplyScalar(d);
      cam.lookAt(0, 0, 0);
      cam.updateMatrixWorld();
      cam.updateProjectionMatrix();
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const q of corners) {
        p.copy(q).project(cam);
        const sx = ((p.x + 1) / 2) * w, sy = ((1 - p.y) / 2) * h;
        x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
      }
      return { x0, x1, y0, y1 };
    };
    let lo = 5, hi = 600;
    for (let it = 0; it < 40; it++) {
      const mid = (lo + hi) / 2, m = measure(mid);
      if (m.x1 - m.x0 <= availW && m.y1 - m.y0 <= availH) hi = mid; else lo = mid;
    }
    const m = measure(hi);
    const offX = (m.x0 + m.x1) / 2 - (mg.left + availW / 2), offY = (m.y0 + m.y1) / 2 - (mg.top + availH / 2);
    cam.setViewOffset(w, h, offX, offY, w, h);
    cam.updateProjectionMatrix();
    this.camPos = cam.position.clone();
    this.ppc = (m.x1 - m.x0) / (BOX.x1 - BOX.x0); // screen pixels per cell, roughly (at the near edge)
    this.screenW = w;
    this.screenH = h;
    this.fieldRect = { left: m.x0 - offX, right: m.x1 - offX, top: m.y0 - offY, bottom: m.y1 - offY };
  };

  // where a 3D object really is on the screen (through the camera, as drawn): the play check uses this
  View.prototype.project = function (obj) {
    obj.updateWorldMatrix(true, false);
    const p = new T.Vector3().setFromMatrixPosition(obj.matrixWorld).project(this.camera);
    return { x: ((p.x + 1) / 2) * this.screenW, y: ((1 - p.y) / 2) * this.screenH };
  };
  View.prototype.kidObj = function (id) { const v = this.kids.get(id); return v && v.root; };

  View.prototype.render = function () {
    this.renderer.render(this.scene, this.camera);
  };

  FB.View = View;
})();
