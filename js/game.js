/* TT Fence Builder: everything around the rules. Screens, keyboard and touch input, the HUD (score, lives, how much is
   garden), the companion button, toasts, the level banner, HI-SCORE saving, the title-screen demo, and test hooks on
   window.game. */
(function () {
  'use strict';
  const FB = window.FB, S = Kit.sound, I = FB.Input;
  const { DT } = FB;
  const $ = (id) => document.getElementById(id);
  const NAME = { teddy: 'TEDDY', tommy: 'TOMMY' };
  const cls = (who) => (who === 'tommy' ? 'm' : 't');
  const fmt = (n) => n.toLocaleString('en-US');
  const NL = FB.LEVELS.length;

  // ---------------------------------------------------------------- saving
  const SAVE_KEY = 'fenceBuilderTT.v1';
  const save = { hi: { easy: 0, normal: 0 }, reached: { easy: 1, normal: 1 }, hero: 'teddy', easy: true };
  try { Object.assign(save, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); } catch (e) { /* storage blocked */ }
  const store = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* storage blocked */ } };
  const dkey = () => (G.easy ? 'easy' : 'normal');

  const view = new FB.View($('scene'));
  const faces = Kit.portraits([Kit.roster.get('teddy'), Kit.roster.get('tommy')], { size: 160 });

  const G = {
    screen: 'title', mode: '1p', hero: save.hero === 'tommy' ? 'tommy' : 'teddy', easy: save.easy !== false,
    startLevel: 0, sim: null, runner: null, demo: null, held: false, keepAwake: false, autoPause: true,
    toasts: [], touchOn: false, bannerT: 9, auto: null, doneT: 0, sabotage: null, newHi: false,
  };

  // ---------------------------------------------------------------- keys
  addEventListener('keydown', (e) => {
    S.init();
    if (/^Arrow|^Space$/.test(e.code) || (e.code === 'Slash' && !e.shiftKey)) e.preventDefault();
    if (G.screen === 'play') I.down(e.code);
    if (!e.repeat) onKey(e.code);
  });
  addEventListener('keyup', (e) => I.up(e.code));
  addEventListener('blur', () => { I.clear(); padsReset(); });

  function onKey(code) {
    const sc = G.screen;
    if (code === 'KeyM') return toggleMute();
    if (sc === 'play') {
      if (code === 'KeyT') callBuddy();
      else if (code === 'KeyP' || code === 'Escape') pause();
    } else if (sc === 'pause') {
      if (code === 'KeyP' || code === 'Escape' || code === 'Space' || code === 'Enter') resume();
    } else if (sc === 'title') {
      if (code === 'Enter' || code === 'Space') startGame('1p', G.hero);
      else if (code === 'Digit2' || code === 'Numpad2') startGame('2p');
      else if (code === 'Digit1' || code === 'Numpad1') startGame('1p', G.hero);
      else if (code === 'ArrowLeft' || code === 'KeyA') pickHero('teddy');
      else if (code === 'ArrowRight' || code === 'KeyD') pickHero('tommy');
      else if (code === 'KeyE') setEasy(!G.easy);
    } else if (sc === 'over') {
      if (code === 'Enter' || code === 'Space') keepGoing();
      else if (code === 'Escape') toTitle();
    } else if (sc === 'win') {
      if (code === 'Enter' || code === 'Space') startGame(G.mode, G.hero, 0);
      else if (code === 'Escape') toTitle();
    }
  }

  // what every builder wants this step (keys, the touch controls, or the autopilot)
  function inputs() {
    const out = {};
    I.mirror = G.sabotage === 'mirror';
    if (G.mode === '2p') { out.teddy = I.read(0, DT); out.tommy = I.read(1, DT); }
    else out[G.hero] = I.read(0, DT);
    if (G.auto && G.auto.length && G.auto[0].sim === G.sim) for (const b of G.auto) out[b.p.id] = b.input();
    return out;
  }

  // ---------------------------------------------------------------- touch: a pad and BUILD (and SLOW) for each player
  const padPtr = [null, null];
  function padsReset() {
    for (const n of [0, 1]) { padPtr[n] = null; I.pad[n] = -1; $('pad' + n).dataset.dir = '-1'; }
    for (const id of ['build0', 'build1', 'slow0']) $(id).classList.remove('down');
  }
  function setupTouch() {
    const touchSeen = (e) => { if (e.pointerType === 'touch' && !G.touchOn) { G.touchOn = true; document.body.classList.add('touch'); layoutHud(); } };
    addEventListener('pointerdown', touchSeen, true);
    for (const n of [0, 1]) {
      const pad = $('pad' + n);
      const aim = (e) => {
        const r = pad.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        const d = Math.hypot(dx, dy) < 14 ? -1 : Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0);
        I.pad[n] = d;
        pad.dataset.dir = String(d);
      };
      pad.addEventListener('pointerdown', (e) => {
        S.init();
        e.preventDefault();
        try { pad.setPointerCapture(e.pointerId); } catch (err) { /* fine */ }
        padPtr[n] = e.pointerId;
        aim(e);
      });
      pad.addEventListener('pointermove', (e) => { if (padPtr[n] === e.pointerId) aim(e); });
      const end = (e) => { if (padPtr[n] !== e.pointerId) return; padPtr[n] = null; I.pad[n] = -1; pad.dataset.dir = '-1'; };
      for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) pad.addEventListener(t, end);
    }
    const hold = (id, set) => {
      const b = $(id);
      const on = (e) => { S.init(); e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (err) { /* fine */ } set(true); b.classList.add('down'); };
      const off = () => { set(false); b.classList.remove('down'); };
      b.addEventListener('pointerdown', on);
      for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(t, off);
    };
    hold('build0', (v) => { I.padBuild[0] = v; });
    hold('build1', (v) => { I.padBuild[1] = v; });
    hold('slow0', (v) => { I.padSlow[0] = v; });
    if (matchMedia('(pointer: coarse)').matches) { G.touchOn = true; document.body.classList.add('touch'); }
  }

  // ---------------------------------------------------------------- flow
  const SCREENS = ['title', 'pause', 'over', 'win'];
  function show(screen) {
    G.screen = screen;
    for (const id of SCREENS) $(id).classList.toggle('hidden', id !== screen);
    const playing = screen !== 'title';
    $('hud').classList.toggle('hidden', !playing);
    $('touch').style.visibility = screen === 'play' ? '' : 'hidden';
    S.music(screen === 'play' ? 'play' : screen === 'pause' ? 'pause' : screen === 'over' ? 'over' : 'title');
    if (screen !== 'play') { I.clear(); padsReset(); }
    layoutHud();
  }

  function startGame(mode, hero, level) {
    S.init();
    FB.sfx.start();
    G.mode = mode;
    I.two = mode === '2p';
    document.body.classList.toggle('two', mode === '2p');
    if (hero) { G.hero = hero; save.hero = hero; }
    save.easy = G.easy;
    store();
    G.demo = null;
    G.auto = null;
    G.doneT = 0;
    G.newHi = false;
    clearToasts();
    const lv = Math.max(0, Math.min(NL - 1, level ?? G.startLevel));
    G.sim = new FB.Sim({ level: lv, mode, hero: G.hero, buddy: Kit.roster.buddyFor(G.hero), easy: G.easy, seed: (Math.random() * 1e9) | 0, sabotage: G.sabotage });
    G.runner = new FB.Runner(G.sim);
    view.setGame(G.sim);
    G.sim.events.length = 0;
    levelBanner(lv);
    setupHud();
    view.update(G.sim, 0);
    show('play');
  }

  function levelBanner(lv) {
    $('bnNum').textContent = `PICTURE ${lv + 1} OF ${NL}`;
    $('bnName').textContent = "What's hiding under the field?";
    $('bnTip').textContent = `Fence off ${Math.round((G.sim ? G.sim.target : 0.6) * 100)}% of the field to find out!`;
    G.bannerT = 0;
  }

  function keepGoing() {
    if (!G.sim || G.screen !== 'over') return;
    G.sim.keepGoing();
    clearToasts();
    toast('KEEP GOING! ❤️', { big: true, life: 1.6 });
    show('play');
  }

  function win() {
    const sim = G.sim;
    const who = G.mode === '2p' ? 'Teddy and Tommy' : G.hero === 'tommy' ? 'Tommy' : 'Teddy';
    keepHi();
    $('winText').textContent = `${who} found all ${NL} hidden pictures!`;
    $('winScore').textContent = `SCORE ${fmt(sim.score)}`;
    $('winHi').textContent = G.newHi ? `NEW HI-SCORE! ${fmt(save.hi[dkey()])}` : `HI-SCORE ${fmt(save.hi[dkey()])}`;
    show('win');
  }

  function keepHi() {
    const sim = G.sim, k = dkey();
    if (!sim) return;
    if (sim.score > (save.hi[k] || 0)) { save.hi[k] = sim.score; G.newHi = true; }
    save.reached[k] = Math.max(save.reached[k] || 1, Math.min(NL, sim.level + 1));
    store();
  }

  function pause() { if (G.screen === 'play') show('pause'); }
  function resume() { if (G.screen === 'pause') show('play'); }

  function toTitle() {
    keepHi();
    clearToasts();
    G.sim = null;
    G.auto = null;
    startDemo();
    show('title');
    refreshTitle();
  }

  function callBuddy() {
    const sim = G.sim;
    if (!sim || G.screen !== 'play') return;
    S.init();
    if (!sim.callBuddy() && G.mode === '2p' && sim.hi5Cd > 0) toast(`HIGH FIVE IN ${Math.ceil(sim.hi5Cd)}…`, { life: 0.9 });
    // the events from a call between frames: handle them now (the next step starts with a fresh list)
    for (const ev of sim.events) handle(ev, sim);
    sim.events.length = 0;
  }

  // ---------------------------------------------------------------- the rules' events
  function afterSteps() {
    const sim = G.sim;
    for (const ev of sim.events) handle(ev, sim);
    sim.events.length = 0;
    if (sim.state === 'over' && G.screen === 'play') {
      keepHi();
      $('overText').textContent = `Out of lives on picture ${sim.level + 1}. Keep going: your garden stays!`;
      show('over');
    }
  }

  function handle(ev, sim, quiet) {
    view.onEvent(ev, sim);
    if (quiet) return;
    const fx = FB.sfx, L = FB.LEVELS[sim.level];
    switch (ev.type) {
      case 'level': fx.level(); levelBanner(ev.level); break;
      case 'buildStart': fx.buildStart(); break;
      case 'post': fx.post(ev.slow); break;
      case 'rollback': fx.rollback(); break;
      case 'claim': {
        fx.claim(ev.cells, ev.slow);
        const pct = Math.floor(ev.pct * 100);
        if (ev.slow) toast(`🐢 SLOW BUILD! DOUBLE POINTS: +${fmt(ev.pts)}`, { cls: cls(ev.who), life: 1.6 });
        else if (ev.cells >= 150) toast(`WOW! A BIG GARDEN! ${pct}%`, { big: true, cls: cls(ev.who), life: 1.6 });
        break;
      }
      case 'snap':
        fx.snap(ev.lost);
        if (!ev.cut) toast(ev.lost ? `BOING! THE BALL HIT ${NAME[ev.who]}'S FENCE! 💔` : 'BOING! THE FENCE SNAPPED BACK!', { cls: cls(ev.who), life: 1.5 });
        break;
      case 'bounce': fx.bounce(); break;
      case 'bugPop': fx.sneeze(); toast(`ACHOO! A BUG SNEEZED ON ${NAME[ev.who]}! 💔`, { cls: cls(ev.who), life: 1.6 }); break;
      case 'bugIn': fx.bugIn(); break;
      case 'oops': fx.oops(); if (ev.lives <= 0) toast('OUT OF LIVES! 💔', { big: true, life: 1.5 }); break;
      case 'clear':
        fx.clear();
        toast(`IT'S A ${L.name}! ${L.emoji}`, { big: true, life: 2.6 });
        toast(`PICTURE ${ev.level + 1} DONE! +${fmt(ev.bonus)} 🎉`, { life: 2.4 });
        keepHi();
        break;
      case 'done': fx.done(); break;
      case 'buddyIn': fx.buddyIn(); toast(`${NAME[ev.who]} IS COMING TO HELP!`, { cls: cls(ev.who), life: 1.8 }); break;
      case 'gift': fx.gift(); toast(`${ev.emoji} ${ev.name} FROM ${NAME[ev.from]}!${ev.heal ? ' +❤️' : ''}`, { cls: cls(ev.from), life: 2 }); break;
      case 'freeze': fx.freeze(); toast(`${NAME[ev.who]} SAYS: FREEZE, BALL! ❄️`, { big: true, cls: cls(ev.who), life: 2 }); break;
      case 'thaw': fx.thaw(); break;
      case 'buddyOut': fx.buddyOut(); toast(`BYE BYE, ${NAME[ev.who]}! 👋`, { cls: cls(ev.who), life: 1.4 }); break;
      case 'highfive': fx.highfive(); toast('✋ HIGH FIVE! THE BALL FREEZES!', { big: true, life: 2 }); break;
      case 'over': fx.over(); break;
    }
  }

  // ---------------------------------------------------------------- the title-screen demo
  function startDemo(lv) {
    lv = lv ?? Math.floor(Math.random() * NL);
    const sim = new FB.Sim({ level: lv, mode: '2p', seed: (Math.random() * 1e9) | 0, easy: true });
    G.demo = { sim, lv, t: 0, runner: new FB.Runner(sim), bots: sim.players.map((p) => new FB.Bot(sim, p, (Math.random() * 1e9) | 0)) };
    view.setGame(sim);
  }

  function demoInput() {
    const inp = {};
    for (const b of G.demo.bots) inp[b.p.id] = b.input();
    return inp;
  }

  function demoAfter() {
    const d = G.demo;
    for (const ev of d.sim.events) handle(ev, d.sim, true);
    d.sim.events.length = 0;
    if ((d.sim.state === 'clear' && d.sim.stateT > 3) || d.sim.state === 'done' || d.t > 150) startDemo((d.lv + 1) % NL);
  }

  // ---------------------------------------------------------------- HUD
  function setupHud() {
    const two = G.mode === '2p';
    $('pcard').className = 'pcard' + (two ? ' two' : G.hero === 'tommy' ? ' m' : '');
    $('faceA').src = two ? faces.teddy : faces[G.hero];
    $('faceA').className = 'face' + (!two && G.hero === 'tommy' ? ' m' : '');
    $('faceB').src = faces.tommy;
    $('faceB').classList.toggle('hidden', !two);
    $('pad0').classList.toggle('m', !two && G.hero === 'tommy');
    const btn = $('callBtn'), bud = Kit.roster.buddyFor(G.hero);
    btn.classList.toggle('t', !two && bud === 'teddy');
    btn.querySelector('img').src = faces[bud];
    btn.querySelector('img').classList.toggle('hidden', two);
    btn.querySelector('.five').classList.toggle('hidden', !two);
    G.hudCache = {};
    updateHud();
    layoutHud();
  }

  // Frame the field in the space the HUD and the touch controls leave (and clear of the kit's buttons on the left).
  function layoutHud() {
    const playing = !$('hud').classList.contains('hidden');
    const h = innerHeight, w = innerWidth;
    const short = h <= 520;
    const top = document.querySelector('#hud .top');
    const mg = { top: 8, bottom: 8, left: 58, right: 8 };
    if (playing) mg.top = Math.min(h * 0.3, top.getBoundingClientRect().bottom + 4);
    view.margins = Object.assign({}, mg);
    if (playing && G.touchOn) {
      // either keep a strip along the bottom for the controls, or columns down the sides: whichever leaves a bigger field
      const r = (id) => $(id).getBoundingClientRect();
      const two = G.mode === '2p';
      const ctl = two ? [r('pad0'), r('pad1'), r('build0'), r('build1')] : [r('pad0'), r('build0'), r('slow0')];
      const strip = h - Math.min(...ctl.map((q) => q.top)) + 6;
      const leftCol = Math.max(...ctl.filter((q) => q.left < w / 2).map((q) => q.right)) + 8;
      const rightCol = w - Math.min(...ctl.filter((q) => q.left >= w / 2).map((q) => q.left)) + 8;
      const A = Object.assign({}, mg, { bottom: strip });
      const B = Object.assign({}, mg, { left: Math.max(mg.left, leftCol), right: Math.max(mg.right, rightCol) });
      view.margins = A;
      view.fit(true);
      const ppcA = view.ppc;
      view.margins = B;
      view.fit(true);
      if (ppcA > view.ppc) view.margins = A;
    }
    document.querySelector('#hud .mid .pill.small').classList.toggle('hidden', short && playing);
    view.fit(true);
  }
  addEventListener('resize', () => setTimeout(layoutHud, 50));

  function setText(key, el, text, html) {
    if (G.hudCache[key] === text) return;
    G.hudCache[key] = text;
    if (html) el.innerHTML = text; else el.textContent = text;
  }

  function updateHud() {
    const sim = G.sim;
    if (!sim || !G.hudCache) return;
    setText('score', $('score'), fmt(sim.score));
    const narrow = innerWidth < 480;
    const hearts = sim.lives <= 0 ? '💔' : narrow && sim.lives > 2 ? `❤️×${sim.lives}` : '❤️'.repeat(Math.min(sim.lives, 6));
    setText('hearts', $('hearts'), hearts);
    setText('level', $('levelNum'), String(sim.level + 1));
    const pct = sim.state === 'clear' || sim.state === 'done' ? Math.max(sim.pct(), sim.target) : sim.pct();
    setText('pct', $('pctNum'), `${Math.floor(pct * 100 + 1e-9)}% / ${Math.round(sim.target * 100)}%`);
    const bar = Math.min(1, pct);
    if (G.hudCache.bar !== bar) {
      G.hudCache.bar = bar;
      $('pctBar').style.width = (bar * 100).toFixed(1) + '%';
      $('pctMark').style.left = `calc(${(sim.target * 100).toFixed(1)}% - 1px)`;
      $('meter').classList.toggle('hit', pct >= sim.target);
    }
    const hi = Math.max(save.hi[dkey()] || 0, sim.score);
    setText('hi', $('hiNum'), fmt(hi));
    const B = sim.buddy, here = !!B && B.state !== 'leave';
    const btn = $('callBtn');
    btn.classList.toggle('here', here || sim.ball.frozenT > 0);
    const bud = Kit.roster.buddyFor(G.hero);
    let label;
    if (G.mode === '2p') {
      const cd = sim.hi5Cd;
      btn.querySelector('.cool').style.background = cd > 0 ? `conic-gradient(rgba(10,8,25,0.65) ${(cd / FB.HI5_CD) * 360}deg, transparent 0)` : 'none';
      label = cd > 0 ? `HIGH FIVE<small>ready in ${Math.ceil(cd)}</small>` : 'HIGH FIVE! ✋<small>press T</small>';
    } else {
      btn.querySelector('.cool').style.background = 'none';
      label = here ? `${NAME[bud]} IS HERE!<small>tap for another freeze</small>` : `CALL ${NAME[bud]}<small>press T</small>`;
    }
    setText('call', btn.querySelector('em'), label, true);
    const fz = sim.ball.frozenT;
    $('freezeBar').classList.toggle('hidden', !(fz > 0 && sim.state === 'play'));
    if (fz > 0) $('freezeBar').querySelector('b').style.transform = `scaleX(${Math.max(0, Math.min(1, fz / FB.FREEZE))})`;
  }

  // ---------------------------------------------------------------- toasts and the level banner (game time)
  function toast(text, o = {}) {
    const el = document.createElement('div');
    el.className = 'toast' + (o.big ? ' huge' : '') + (o.cls ? ' ' + o.cls : '');
    el.textContent = text;
    $('toasts').appendChild(el);
    G.toasts.push({ el, t: 0, life: o.life || 1.6 });
    const live = G.toasts.filter((q) => !q.done);
    if (live.length > 3) live[0].life = 0;
  }

  function clearToasts() {
    for (const q of G.toasts) q.el.remove();
    G.toasts = [];
  }

  function updateToasts(dt) {
    for (const q of G.toasts) {
      q.t += dt;
      const a = Math.min(1, q.t * 6, (q.life - q.t) * 4);
      q.el.style.opacity = Math.max(0, a);
      q.el.style.transform = `scale(${0.7 + 0.3 * Math.min(1, q.t * 6) + (q.t < 0.25 ? Math.sin(q.t * 12.5) * 0.08 : 0)})`;
      if (q.t >= q.life) { q.el.remove(); q.done = true; }
    }
    G.toasts = G.toasts.filter((q) => !q.done);
  }

  function updateBanner(dt) {
    const sim = G.sim;
    if (G.screen === 'play' && sim) G.bannerT += dt;
    const on = G.screen === 'play' && sim && sim.state === 'play' && G.bannerT < 2.8;
    $('banner').classList.toggle('hidden', !on);
    if (on) $('banner').style.opacity = Math.min(1, (2.8 - G.bannerT) * 3);
  }

  // ---------------------------------------------------------------- the loop
  function tick(dt) {
    if (G.sim && (G.screen === 'play' || G.screen === 'win' || G.screen === 'over')) {
      if (G.screen === 'play') {
        const n = G.runner.advance(dt, inputs);
        if (n > 0) afterSteps();
        if (G.sim.state === 'done' && G.screen === 'play') { G.doneT += dt; if (G.doneT > 3.2) win(); }
      } else { G.runner.advance(dt, () => ({})); for (const ev of G.sim.events) handle(ev, G.sim, true); G.sim.events.length = 0; }
    } else if (G.screen === 'title' && G.demo) {
      G.demo.t += dt;
      G.demo.runner.advance(dt, demoInput);
      demoAfter();
    }
    const sim = activeSim();
    if (sim) view.update(sim, dt);
    updateHud();
    updateToasts(dt);
    updateBanner(dt);
    view.render();
  }

  const activeSim = () => (G.screen === 'title' ? G.demo && G.demo.sim : G.sim);

  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    if (G.held) { view.render(); return; }
    tick(dt);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (!G.keepAwake && G.autoPause) { pause(); S.suspend(); }
    } else S.resume();
  });

  // ---------------------------------------------------------------- the title screen
  function refreshTitle() {
    const zh = Kit.lang.is('zh');
    $('logo').innerHTML = zh ? `<span class="b">${FB.TITLE_ZH}</span>` : FB.TITLE.replace(/^(\S+) (\S+) (\S+)$/, '<span class="a">$1</span> <span class="b">$2</span><br><span class="c">$3</span>');
    $('subtitle').textContent = FB.SUBTITLE;
    for (const b of document.querySelectorAll('.kid')) {
      b.querySelector('img').src = faces[b.dataset.hero];
      b.classList.toggle('pick', b.dataset.hero === G.hero);
    }
    $('img2pT').src = faces.teddy;
    $('img2pM').src = faces.tommy;
    for (const b of document.querySelectorAll('#segEasy button')) b.classList.toggle('on', (b.dataset.easy === '1') === G.easy);
    const max = maxLevel();
    if (G.startLevel >= max) G.startLevel = 0;
    $('startNum').textContent = String(G.startLevel + 1);
    $('btnLevel').classList.toggle('hidden', max <= 1);
    const hi = save.hi[dkey()] || 0;
    $('bestLine').textContent = hi ? `HI-SCORE ${fmt(hi)}` : '';
    muteIcons();
  }
  Kit.lang.onChange(() => { if (G.screen === 'title') refreshTitle(); });

  const maxLevel = () => Math.max(1, Math.min(NL, save.reached[dkey()] || 1));

  function pickHero(id) { G.hero = id; save.hero = id; store(); refreshTitle(); }

  function setEasy(on) {
    G.easy = on;
    save.easy = on;
    store();
    refreshTitle();
  }

  function toggleMute() {
    S.init();
    S.toggleMute();
    muteIcons();
  }

  function muteIcons() {
    const m = S.isMuted() ? '🔇' : '🔊';
    $('btnMute').textContent = m;
    $('btnMute2').textContent = m;
  }
  S.onMute(muteIcons);

  function wire() {
    const click = (id, fn) => $(id).addEventListener('click', (e) => { S.init(); FB.sfx.click(); fn(e); });
    for (const b of document.querySelectorAll('.kid')) b.addEventListener('click', () => startGame('1p', b.dataset.hero));
    click('btn2p', () => startGame('2p'));
    for (const b of document.querySelectorAll('#segEasy button')) b.addEventListener('click', () => { S.init(); FB.sfx.click(); setEasy(b.dataset.easy === '1'); });
    click('btnLevel', () => { G.startLevel = (G.startLevel + 1) % maxLevel(); refreshTitle(); });
    click('btnMute', toggleMute);
    click('btnMute2', toggleMute);
    click('btnPause', pause);
    click('btnResume', resume);
    click('btnRestart', () => startGame(G.mode, G.hero, G.sim ? G.sim.level : 0));
    click('btnMenu', toTitle);
    click('btnKeep', keepGoing);
    click('btnOverMenu', toTitle);
    click('btnAgain', () => startGame(G.mode, G.hero, 0));
    click('btnWinMenu', toTitle);
    $('callBtn').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); callBuddy(); });
  }

  // ---------------------------------------------------------------- start
  setupTouch();
  wire();
  const q = new URLSearchParams(location.search);
  if (q.has('level')) {
    if (q.has('easy')) G.easy = q.get('easy') === '1';
    startGame(q.get('mode') === '2p' ? '2p' : '1p', q.get('hero') === 'tommy' ? 'tommy' : G.hero, (+q.get('level') || 1) - 1);
  } else {
    startDemo();
    show('title');
    refreshTitle();
  }
  requestAnimationFrame(frame);

  // ---------------------------------------------------------------- test hooks
  // The Browser pane throttles requestAnimationFrame while hidden, so tests drive the game with step().
  window.game = {
    G, view, faces, save, input: I,
    get sim() { return G.sim; },
    // advance the game by `seconds` of game time through the same runner the screen uses; draw: false skips rendering
    step(seconds = 0.5, o = {}) {
      const frames = Math.max(1, Math.round(seconds / (1 / 60)));
      for (let i = 0; i < frames; i++) {
        if (o.draw === false) {
          if (G.sim && G.screen === 'play') {
            const n = G.runner.advance(1 / 60, inputs);
            if (n > 0) afterSteps();
            if (G.sim.state === 'done' && G.screen === 'play') { G.doneT += 1 / 60; if (G.doneT > 3.2) win(); }
          } else if (G.screen === 'title' && G.demo) { G.demo.runner.advance(1 / 60, demoInput); demoAfter(); }
          const sim = activeSim();
          if (sim) view.update(sim, 1 / 60);
          updateToasts(1 / 60);
          updateBanner(1 / 60);
        } else tick(1 / 60);
      }
      updateHud();
      view.render();
      return this.state();
    },
    hold(on = true) { G.held = on; },
    keepAwake() { G.keepAwake = true; },
    autoPause(on = true) { G.autoPause = on; },
    start(level = 1, mode = '1p', hero = 'teddy', easy = true) { G.easy = easy; startGame(mode, hero, level - 1); return this.state(); },
    title() { toTitle(); },
    demo(level = 1) { toTitle(); startDemo(level - 1); },
    call() { callBuddy(); },
    pause, resume, keepGoing,
    showTouch(on = true) { G.touchOn = on; document.body.classList.toggle('touch', on); layoutHud(); },
    sabotage(kind) { G.sabotage = kind || null; },
    state() {
      const s = G.sim;
      return {
        screen: G.screen, mode: G.mode, hero: G.hero, easy: G.easy,
        sim: s && { state: s.state, level: s.level + 1, t: +s.t.toFixed(2), pct: +(s.pct() * 100).toFixed(1), lives: s.lives, score: s.score,
          builders: s.players.map((p) => `${p.id}@${p.i},${p.j} ${p.mode}${p.path.length ? ' fence ' + (p.path.length - 1) : ''}${p.oopsT > 0 ? ' oops' : ''}`),
          ball: `${s.ball.x.toFixed(1)},${s.ball.y.toFixed(1)}${s.ball.frozenT > 0 ? ' frozen' : ''}`, bugs: s.bugs.length, buddy: s.buddy && `${s.buddy.id}:${s.buddy.state}` },
      };
    },
    // the headless checks (js/checks.js), the same as `node tools/check.js`
    check(quick = true) { const r = FB.checks.run({ quick }); return { ok: r.ok, lines: r.lines }; },
    prove() { const r = FB.checks.prove(); return { ok: r.ok, lines: r.lines }; },
    // the autopilot plays the real game (screenshots, demos)
    autopilot(on = true) { G.auto = on && G.sim ? G.sim.players.map((p) => new FB.Bot(G.sim, p)) : null; },
  };
})();
