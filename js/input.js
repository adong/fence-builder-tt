/* TT Fence Builder: what each builder wants this step, from the keys and the touch controls: { dir: 0 up | 1 right |
   2 down | 3 left | -1, build, slow }. Keys come from real keydown / keyup events (js/game.js passes them in).
   - The arrow you pressed last wins while you hold several.
   - A tap shorter than a frame still counts: a pressed direction or BUILD is "latched" for a moment.
   - 1 player: both key sets move you; Space, Enter or / builds; Shift, X or . builds slowly (double points).
   - 2 players: Teddy WASD, Space builds, Left Shift or Q slowly; Tommy the arrows, Enter or / builds, Right Shift or . slowly.
   - Leaving the window (blur) lets go of everything, so no key can get stuck down. */
(function () {
  'use strict';
  const DIR1 = { KeyW: 0, KeyD: 1, KeyS: 2, KeyA: 3 };
  const DIR2 = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3 };
  const BUILD1 = { Space: 1 }, BUILD2 = { Enter: 1, NumpadEnter: 1, Slash: 1 };
  const SLOW1 = { ShiftLeft: 1, KeyQ: 1, KeyX: 1 }, SLOW2 = { ShiftRight: 1, Period: 1 };
  const LATCH = 0.1;   // shorter than one step of walking, so a tap is exactly one step
  const I = {
    two: false,
    mirror: false, // only for the play check's "must fail" run: swaps left and right
    stacks: [[], []], builds: [new Set(), new Set()], slows: [new Set(), new Set()], latch: [{ d: -1, t: 0 }, { d: -1, t: 0 }], buildLatch: [0, 0],
    pad: [-1, -1], padBuild: [false, false], padSlow: [false, false],
    who(code) {
      if (code in DIR1 || code in BUILD1 || code in SLOW1) return 0;
      if (code in DIR2 || code in BUILD2 || code in SLOW2) return this.two ? 1 : 0;
      return -1;
    },
    isGameKey: (code) => code in DIR1 || code in DIR2 || code in BUILD1 || code in BUILD2 || code in SLOW1 || code in SLOW2,
    down(code) {
      const i = this.who(code);
      if (i < 0) return false;
      if (code in DIR1 || code in DIR2) {
        const d = code in DIR1 ? DIR1[code] : DIR2[code];
        const st = this.stacks[i];
        const at = st.indexOf(code);
        if (at >= 0) st.splice(at, 1);
        st.push(code);
        this.latch[i] = { d, t: LATCH };
      } else if (code in BUILD1 || code in BUILD2) {
        this.builds[i].add(code);
        this.buildLatch[i] = LATCH;
      } else this.slows[i].add(code);
      return true;
    },
    up(code) {
      const i = this.who(code);
      for (const k of [0, 1]) {
        const at = this.stacks[k].indexOf(code);
        if (at >= 0) this.stacks[k].splice(at, 1);
        this.builds[k].delete(code);
        this.slows[k].delete(code);
      }
      return i >= 0;
    },
    clear() {
      this.stacks = [[], []];
      this.builds = [new Set(), new Set()];
      this.slows = [new Set(), new Set()];
      this.latch = [{ d: -1, t: 0 }, { d: -1, t: 0 }];
      this.buildLatch = [0, 0];
      this.pad = [-1, -1];
      this.padBuild = [false, false];
      this.padSlow = [false, false];
    },
    read(i, dt) {
      const st = this.stacks[i];
      let dir = -1;
      if (st.length) { const c = st[st.length - 1]; dir = c in DIR1 ? DIR1[c] : DIR2[c]; }
      else if (this.pad[i] >= 0) dir = this.pad[i];
      else if (this.latch[i].t > 0) dir = this.latch[i].d;
      this.latch[i].t = Math.max(0, this.latch[i].t - dt);
      const slow = this.slows[i].size > 0 || this.padSlow[i];
      const build = this.builds[i].size > 0 || this.padBuild[i] || this.buildLatch[i] > 0 || slow;
      this.buildLatch[i] = Math.max(0, this.buildLatch[i] - dt);
      if (this.mirror && (dir === 1 || dir === 3)) dir = 4 - dir;
      return { dir, build, slow };
    },
  };
  FB.Input = I;
})();
