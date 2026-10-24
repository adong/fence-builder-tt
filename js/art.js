/* TT Fence Builder: everything painted on a canvas (no image files). The five hidden pictures (our own drawings: a panda,
   a rocket, a dragon boat, a whale and a birthday cake, each in a garden), the open field's sandy meadow, the field
   texture that shows the picture wherever the land is claimed, the beach ball's stripes and a few sprites.
   Exposes FB.art. */
(function () {
  'use strict';
  const FB = window.FB, G = Kit.gfx;
  const { GW, GH } = FB;
  const CPX = 32;                       // canvas pixels per cell
  const PW = GW * CPX, PH = GH * CPX;   // 1280 x 896

  const circle = (g, x, y, r, fill, stroke, lw) => {
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (stroke) { g.lineWidth = lw || 6; g.strokeStyle = stroke; g.stroke(); }
  };
  const ellipse = (g, x, y, rx, ry, rot, fill, stroke, lw) => {
    g.beginPath();
    g.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2);
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (stroke) { g.lineWidth = lw || 6; g.strokeStyle = stroke; g.stroke(); }
  };
  const INK = '#2a2238';

  // a sunny lawn with mowed stripes and little flowers (every picture is a garden)
  function lawn(g, seed, top = 0) {
    const r = FB.mulberry(seed);
    g.fillStyle = '#74d25c';
    g.fillRect(0, top, PW, PH - top);
    g.save();
    g.beginPath();
    g.rect(0, top, PW, PH - top);
    g.clip();
    for (let k = -PH; k < PW + PH; k += 120) {
      g.fillStyle = 'rgba(255,255,255,0.08)';
      g.beginPath();
      g.moveTo(k, top);
      g.lineTo(k + 60, top);
      g.lineTo(k + 60 - PH, PH);
      g.lineTo(k - PH, PH);
      g.fill();
    }
    const cols = ['#ffffff', '#ffe14a', '#ff8fc8', '#b48cff', '#ff6b6b'];
    for (let n = 0; n < 140; n++) {
      const x = r() * PW, y = top + r() * (PH - top), c = cols[n % cols.length];
      for (let k = 0; k < 5; k++) circle(g, x + Math.cos(k * 1.256) * 6, y + Math.sin(k * 1.256) * 6, 5, c);
      circle(g, x, y, 4, c === '#ffe14a' ? '#ff9f1c' : '#ffe14a');
    }
    g.restore();
  }

  const PICS = {
    panda(g) {
      lawn(g, 11);
      // bamboo down both sides
      for (const [x0, lean] of [[90, 0.05], [190, -0.04], [1100, 0.04], [1200, -0.05]]) {
        g.save();
        g.translate(x0, PH);
        g.rotate(lean);
        for (let y = 0; y > -PH - 80; y -= 120) {
          g.fillStyle = '#5cb85c';
          G.roundRect(g, -22, y - 116, 44, 112, 14);
          g.fill();
          g.lineWidth = 5;
          g.strokeStyle = '#2f7d3a';
          g.stroke();
          g.fillStyle = '#9be38e';
          g.fillRect(-12, y - 106, 8, 90);
          // a leaf now and then
          if ((y / 120) % 2 === 0) {
            ellipse(g, 46, y - 112, 50, 14, -0.5, '#3fa34d', '#2f7d3a', 4);
            ellipse(g, -46, y - 60, 46, 13, 0.5, '#3fa34d', '#2f7d3a', 4);
          }
        }
        g.restore();
      }
      const cx = 640, cy = 470;
      // body peeking out below
      ellipse(g, cx, cy + 330, 330, 190, 0, '#ffffff', INK, 10);
      ellipse(g, cx - 250, cy + 300, 90, 120, 0.4, INK);
      ellipse(g, cx + 250, cy + 300, 90, 120, -0.4, INK);
      // ears, head
      circle(g, cx - 205, cy - 205, 95, INK);
      circle(g, cx + 205, cy - 205, 95, INK);
      circle(g, cx - 205, cy - 205, 48, '#5a4a6a');
      circle(g, cx + 205, cy - 205, 48, '#5a4a6a');
      ellipse(g, cx, cy, 285, 255, 0, '#ffffff', INK, 12);
      // eye patches and eyes
      for (const s of [-1, 1]) {
        ellipse(g, cx + s * 105, cy - 25, 72, 100, s * 0.55, INK);
        circle(g, cx + s * 100, cy - 30, 32, '#ffffff');
        circle(g, cx + s * 104, cy - 26, 18, INK);
        circle(g, cx + s * 96, cy - 36, 8, '#ffffff');
        circle(g, cx + s * 170, cy + 75, 34, '#ffb3c7');
      }
      // nose and smile
      g.fillStyle = INK;
      g.beginPath();
      g.moveTo(cx - 40, cy + 55);
      g.quadraticCurveTo(cx, cy + 40, cx + 40, cy + 55);
      g.quadraticCurveTo(cx, cy + 105, cx - 40, cy + 55);
      g.fill();
      g.lineWidth = 9;
      g.strokeStyle = INK;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(cx, cy + 92);
      g.lineTo(cx, cy + 118);
      g.moveTo(cx - 60, cy + 112);
      g.quadraticCurveTo(cx - 30, cy + 150, cx, cy + 118);
      g.quadraticCurveTo(cx + 30, cy + 150, cx + 60, cy + 112);
      g.stroke();
      // a bamboo snack in his paw
      g.save();
      g.translate(cx + 300, cy + 210);
      g.rotate(-0.6);
      g.fillStyle = '#5cb85c';
      G.roundRect(g, -18, -150, 36, 230, 12);
      g.fill();
      g.lineWidth = 5;
      g.strokeStyle = '#2f7d3a';
      g.stroke();
      ellipse(g, 30, -150, 46, 14, -0.6, '#3fa34d', '#2f7d3a', 4);
      g.restore();
      circle(g, cx + 300, cy + 240, 62, INK);
    },

    rocket(g) {
      // sky above, a garden below
      const sky = g.createLinearGradient(0, 0, 0, PH * 0.72);
      sky.addColorStop(0, '#5ec8ff');
      sky.addColorStop(1, '#c4f0ff');
      g.fillStyle = sky;
      g.fillRect(0, 0, PW, PH);
      lawn(g, 23, PH * 0.72);
      g.fillStyle = '#5bbd4a';
      g.beginPath();
      g.moveTo(0, PH * 0.74);
      for (let x = 0; x <= PW; x += 40) g.lineTo(x, PH * 0.72 + Math.sin(x / 140) * 22);
      g.lineTo(PW, PH);
      g.lineTo(0, PH);
      g.fill();
      lawn(g, 24, PH * 0.78);
      // clouds and a sun
      circle(g, 1120, 120, 70, '#ffe14a', '#ffb52e', 8);
      for (const [x, y, s] of [[180, 140, 1], [470, 90, 0.8], [880, 230, 0.9], [1100, 380, 0.7], [140, 420, 0.75]]) {
        for (const [dx, dy, r] of [[-50, 10, 40], [0, -10, 55], [55, 8, 42], [10, 22, 40]]) circle(g, x + dx * s, y + dy * s, r * s, '#ffffff');
      }
      // smoke puffs down to the grass
      for (let k = 0; k < 9; k++) circle(g, 520 - k * 30 + (k % 2) * 30, 640 + k * 26, 50 + k * 6, k % 2 ? '#f4f4f4' : '#ffffff', '#d8d8e8', 4);
      g.save();
      g.translate(640, 400);
      g.rotate(0.35);
      // flame
      ellipse(g, 0, 270, 60, 120, 0, '#ff8a1c');
      ellipse(g, 0, 250, 36, 80, 0, '#ffe14a');
      // fins
      for (const s of [-1, 1]) {
        g.fillStyle = '#ff4b5c';
        g.beginPath();
        g.moveTo(s * 70, 60);
        g.quadraticCurveTo(s * 175, 140, s * 160, 250);
        g.lineTo(s * 70, 190);
        g.closePath();
        g.fill();
        g.lineWidth = 9;
        g.strokeStyle = INK;
        g.stroke();
      }
      // body
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.moveTo(0, -300);
      g.bezierCurveTo(110, -220, 105, 60, 85, 200);
      g.lineTo(-85, 200);
      g.bezierCurveTo(-105, 60, -110, -220, 0, -300);
      g.fill();
      g.lineWidth = 10;
      g.strokeStyle = INK;
      g.stroke();
      // red nose and stripes
      g.save();
      g.clip();
      g.fillStyle = '#ff4b5c';
      g.fillRect(-150, -320, 300, 120);
      g.fillStyle = '#3d9bff';
      g.fillRect(-150, 130, 300, 34);
      g.restore();
      g.lineWidth = 10;
      g.stroke();
      // windows
      for (const y of [-110, 10]) {
        circle(g, 0, y, 46, '#ffd23f', INK, 8);
        circle(g, 0, y, 32, '#7fd7ff');
        circle(g, -10, y - 12, 9, '#ffffff');
      }
      g.fillStyle = '#ff4b5c';
      G.roundRect(g, -16, 160, 32, 70, 10);
      g.fill();
      g.restore();
      // sparkles
      for (const [x, y] of [[330, 260], [930, 130], [800, 560], [260, 560]]) {
        g.fillStyle = '#ffffff';
        g.beginPath();
        for (let k = 0; k < 8; k++) { const r = k % 2 ? 9 : 28, a = (k * Math.PI) / 4; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
        g.fill();
      }
    },

    boat(g) {
      lawn(g, 37);
      // the river
      g.fillStyle = '#4fb8ff';
      g.beginPath();
      g.moveTo(0, 300);
      for (let x = 0; x <= PW; x += 40) g.lineTo(x, 300 + Math.sin(x / 160) * 25);
      for (let x = PW; x >= 0; x -= 40) g.lineTo(x, 720 + Math.sin(x / 130 + 1) * 25);
      g.fill();
      g.lineWidth = 10;
      g.strokeStyle = '#2f8fd8';
      g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.7)';
      g.lineWidth = 6;
      g.lineCap = 'round';
      for (let n = 0; n < 16; n++) {
        const x = (n * 173) % PW, y = 360 + ((n * 97) % 320);
        g.beginPath();
        g.arc(x, y, 26, Math.PI * 1.1, Math.PI * 1.9);
        g.stroke();
      }
      // paddlers (behind the hull)
      const shirts = ['#3d9bff', '#2fd6a2', '#ffd23f', '#ff7ab8', '#a066e8', '#ff8a1c'];
      for (let k = 0; k < 6; k++) {
        const x = 330 + k * 110;
        g.strokeStyle = '#8a5a2b';
        g.lineWidth = 10;
        g.beginPath();
        g.moveTo(x + 10, 430);
        g.lineTo(x - 50, 640);
        g.stroke();
        ellipse(g, x - 52, 650, 16, 30, 0.3, '#c98a4b', INK, 4);
        G.roundRect(g, x - 28, 430, 56, 80, 18);
        g.fillStyle = shirts[k];
        g.fill();
        g.lineWidth = 5;
        g.strokeStyle = INK;
        g.stroke();
        circle(g, x, 405, 34, '#ffd9b3', INK, 5);
        g.fillStyle = k % 2 ? '#6b3a1e' : INK;
        g.beginPath();
        g.arc(x, 398, 34, Math.PI, 0);
        g.fill();
        circle(g, x - 11, 410, 4, INK);
        circle(g, x + 11, 410, 4, INK);
      }
      // the hull with golden scales
      g.fillStyle = '#ff4b4b';
      g.beginPath();
      g.moveTo(170, 490);
      g.lineTo(1080, 490);
      g.quadraticCurveTo(1070, 600, 960, 610);
      g.lineTo(290, 610);
      g.quadraticCurveTo(180, 600, 170, 490);
      g.fill();
      g.lineWidth = 10;
      g.strokeStyle = INK;
      g.stroke();
      g.strokeStyle = '#ffd23f';
      g.lineWidth = 5;
      for (let x = 230; x < 1040; x += 44) for (const y of [520, 560]) { g.beginPath(); g.arc(x + (y === 560 ? 22 : 0), y, 18, 0, Math.PI); g.stroke(); }
      // the drum in the middle
      ellipse(g, 640, 470, 60, 22, 0, '#ffd23f', INK, 6);
      // the dragon's tail (left) and head (right)
      g.fillStyle = '#2fd65a';
      g.beginPath();
      g.moveTo(180, 500);
      g.bezierCurveTo(100, 470, 80, 340, 150, 300);
      g.bezierCurveTo(210, 270, 240, 340, 190, 360);
      g.bezierCurveTo(150, 380, 170, 440, 230, 470);
      g.closePath();
      g.fill();
      g.lineWidth = 8;
      g.strokeStyle = INK;
      g.stroke();
      g.fillStyle = '#2fd65a';
      g.beginPath();
      g.moveTo(1040, 500);
      g.bezierCurveTo(1060, 400, 1070, 330, 1130, 300);
      g.bezierCurveTo(1200, 270, 1250, 320, 1240, 370);
      g.bezierCurveTo(1230, 420, 1160, 430, 1120, 420);
      g.bezierCurveTo(1100, 460, 1090, 490, 1080, 510);
      g.closePath();
      g.fill();
      g.stroke();
      // horns, eye, nostril, whiskers, a happy tongue
      g.fillStyle = '#ffd23f';
      for (const dx of [0, 40]) {
        g.beginPath();
        g.moveTo(1120 + dx, 305);
        g.lineTo(1100 + dx, 230);
        g.lineTo(1145 + dx, 295);
        g.closePath();
        g.fill();
        g.lineWidth = 5;
        g.stroke();
      }
      circle(g, 1170, 335, 24, '#ffffff', INK, 5);
      circle(g, 1176, 338, 12, INK);
      circle(g, 1225, 360, 6, INK);
      g.strokeStyle = '#ffd23f';
      g.lineWidth = 6;
      g.beginPath();
      g.moveTo(1235, 380);
      g.quadraticCurveTo(1290, 400, 1270, 450);
      g.moveTo(1215, 395);
      g.quadraticCurveTo(1250, 440, 1220, 470);
      g.stroke();
      ellipse(g, 1225, 420, 22, 10, 0.3, '#ff7ab8');
    },

    whale(g) {
      lawn(g, 41);
      // the pond
      ellipse(g, 640, 520, 560, 300, 0, '#5ec8ff', '#2f8fd8', 12);
      ellipse(g, 640, 520, 520, 265, 0, null, 'rgba(255,255,255,0.45)', 6);
      for (const [x, y] of [[200, 560], [1080, 470], [330, 720], [960, 720]]) {
        ellipse(g, x, y, 50, 34, 0.3, '#3fa34d', '#2f7d3a', 4);
        circle(g, x + 12, y - 6, 12, '#ff8fc8');
      }
      // the water spout
      g.fillStyle = '#bfeaff';
      g.beginPath();
      g.moveTo(560, 330);
      g.bezierCurveTo(540, 220, 520, 160, 470, 120);
      g.lineTo(650, 120);
      g.bezierCurveTo(600, 160, 590, 220, 600, 330);
      g.fill();
      for (const [x, y, r] of [[420, 120, 34], [480, 80, 40], [560, 70, 44], [640, 85, 38], [700, 125, 30], [380, 170, 22], [740, 175, 22]]) circle(g, x, y, r, '#dff6ff', '#7fd7ff', 5);
      // the whale
      g.fillStyle = '#4a7dff';
      g.beginPath();
      g.moveTo(330, 520);
      g.bezierCurveTo(330, 330, 760, 300, 880, 450);
      g.bezierCurveTo(940, 420, 1010, 330, 1060, 300);
      g.bezierCurveTo(1110, 330, 1080, 400, 1040, 430);
      g.bezierCurveTo(1110, 440, 1150, 500, 1140, 540);
      g.bezierCurveTo(1060, 520, 990, 520, 930, 560);
      g.bezierCurveTo(880, 680, 400, 700, 330, 520);
      g.fill();
      g.lineWidth = 11;
      g.strokeStyle = INK;
      g.stroke();
      // white belly with stripes
      g.save();
      g.beginPath();
      g.moveTo(350, 560);
      g.bezierCurveTo(420, 690, 820, 680, 900, 580);
      g.bezierCurveTo(780, 620, 470, 620, 350, 560);
      g.fillStyle = '#eaf2ff';
      g.fill();
      g.restore();
      // a flipper, the eye, cheek and smile
      ellipse(g, 640, 600, 70, 32, 0.5, '#3a66d8', INK, 7);
      circle(g, 440, 470, 26, '#ffffff', INK, 6);
      circle(g, 446, 474, 13, INK);
      circle(g, 440, 466, 5, '#ffffff');
      circle(g, 470, 540, 26, '#ffb3c7');
      g.lineWidth = 8;
      g.strokeStyle = INK;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(360, 530);
      g.quadraticCurveTo(400, 575, 450, 560);
      g.stroke();
    },

    cake(g) {
      lawn(g, 53);
      // a picnic blanket
      g.save();
      g.translate(640, 690);
      g.fillStyle = '#ffffff';
      g.fillRect(-470, -150, 940, 300);
      g.fillStyle = 'rgba(255,75,92,0.85)';
      for (let x = -470; x < 470; x += 80) g.fillRect(x, -150, 40, 300);
      for (let y = -150; y < 150; y += 80) g.fillRect(-470, y, 940, 40);
      g.lineWidth = 8;
      g.strokeStyle = INK;
      g.strokeRect(-470, -150, 940, 300);
      g.restore();
      // balloons
      for (const [x, y, c] of [[170, 230, '#ff4b5c'], [280, 150, '#3d9bff'], [1000, 160, '#ffd23f'], [1110, 250, '#2fd6a2']]) {
        g.strokeStyle = INK;
        g.lineWidth = 4;
        g.beginPath();
        g.moveTo(x, y + 80);
        g.quadraticCurveTo(x + 30, y + 220, x, y + 380);
        g.stroke();
        ellipse(g, x, y, 62, 78, 0, c, INK, 7);
        ellipse(g, x - 20, y - 26, 12, 20, 0.4, 'rgba(255,255,255,0.7)');
      }
      // three tiers
      const tiers = [[640, 650, 300, 130, '#ff9ad5'], [640, 520, 220, 120, '#ffffff'], [640, 400, 140, 110, '#ffe066']];
      for (const [x, y, w, h, c] of tiers) {
        g.fillStyle = c;
        G.roundRect(g, x - w, y - h, w * 2, h, 22);
        g.fill();
        g.lineWidth = 9;
        g.strokeStyle = INK;
        g.stroke();
        // frosting drips
        g.fillStyle = c === '#ffffff' ? '#ff9ad5' : '#ffffff';
        g.beginPath();
        g.moveTo(x - w + 10, y - h + 6);
        for (let k = 0; k <= 8; k++) {
          const xx = x - w + 10 + ((w * 2 - 20) * k) / 8;
          g.quadraticCurveTo(xx - (w * 2 - 20) / 16, y - h + 30 + (k % 2) * 20, xx, y - h + 6);
        }
        g.lineTo(x + w - 10, y - h);
        g.lineTo(x - w + 10, y - h);
        g.fill();
        // sprinkles
        const r = FB.mulberry(w);
        const sc = ['#ff4b5c', '#3d9bff', '#2fd6a2', '#a066e8', '#ff8a1c'];
        for (let n = 0; n < w / 14; n++) {
          g.save();
          g.translate(x - w + 30 + r() * (w * 2 - 60), y - h + 50 + r() * (h - 70));
          g.rotate(r() * 3);
          g.fillStyle = sc[n % sc.length];
          G.roundRect(g, -10, -3, 20, 6, 3);
          g.fill();
          g.restore();
        }
      }
      // strawberries and candles
      for (const x of [560, 640, 720]) {
        g.fillStyle = ['#3d9bff', '#ff4b5c', '#2fd6a2'][(x - 560) / 80];
        G.roundRect(g, x - 12, 210, 24, 85, 6);
        g.fill();
        g.lineWidth = 5;
        g.strokeStyle = INK;
        g.stroke();
        ellipse(g, x, 190, 15, 26, 0, '#ff9f1c');
        ellipse(g, x, 196, 7, 14, 0, '#ffe14a');
      }
      for (const x of [380, 900]) {
        ellipse(g, x, 520, 34, 40, 0, '#ff4b5c', INK, 5);
        g.fillStyle = '#2fd65a';
        g.beginPath();
        g.moveTo(x - 24, 486);
        g.lineTo(x, 498);
        g.lineTo(x + 24, 486);
        g.lineTo(x, 474);
        g.fill();
      }
    },
  };

  const picCache = {};
  function picture(name) {
    if (picCache[name]) return picCache[name];
    const [c, g] = G.makeCanvas(PW, PH);
    (PICS[name] || PICS.panda)(g);
    return (picCache[name] = c);
  }

  // the open field: a sandy meadow with pebbles and a very faint grid, so a kid can see each step
  let openCanvas = null;
  function openField() {
    if (openCanvas) return openCanvas;
    const [c, g] = G.makeCanvas(PW, PH);
    g.fillStyle = '#f2d9a2';
    g.fillRect(0, 0, PW, PH);
    const r = FB.mulberry(5);
    for (let n = 0; n < 60; n++) ellipse(g, r() * PW, r() * PH, 40 + r() * 90, 25 + r() * 50, r() * 3, 'rgba(255,240,205,0.45)');
    for (let n = 0; n < 900; n++) circle(g, r() * PW, r() * PH, 1.5 + r() * 2.5, ['#d9b97c', '#e8c98f', '#c9a56a', '#fff2d2'][n % 4]);
    g.strokeStyle = 'rgba(160,120,60,0.13)';
    g.lineWidth = 2;
    for (let i = 1; i < GW; i++) { g.beginPath(); g.moveTo(i * CPX, 0); g.lineTo(i * CPX, PH); g.stroke(); }
    for (let j = 1; j < GH; j++) { g.beginPath(); g.moveTo(0, j * CPX); g.lineTo(PW, j * CPX); g.stroke(); }
    return (openCanvas = c);
  }

  // The field texture: the picture where the land is claimed, the meadow where it's open, a white edge between them
  // (with a little shadow on the open side, so the garden looks raised). reveal (0..1) fades the whole picture in.
  function FieldTexture() {
    const [c, g] = G.makeCanvas(PW, PH);
    this.canvas = c;
    this.g = g;
    this.tex = G.toTexture(c);
    this.tex.anisotropy = 4;
    this.pic = null;
  }
  FieldTexture.prototype.draw = function (sim, reveal = 0) {
    const g = this.g, cl = sim.cl;
    this.pic = picture(FB.LEVELS[sim.level].pic);
    g.drawImage(openField(), 0, 0);
    g.save();
    g.beginPath();
    for (let j = 0; j < GH; j++) {
      let run = -1;
      for (let i = 0; i <= GW; i++) {
        const on = i < GW && cl[j * GW + i];
        if (on && run < 0) run = i;
        if (!on && run >= 0) { g.rect(run * CPX, j * CPX, (i - run) * CPX, CPX); run = -1; }
      }
    }
    g.clip();
    g.drawImage(this.pic, 0, 0);
    g.restore();
    // the edge: a shadow on the open side, then a white line
    const open = (i, j) => i >= 0 && j >= 0 && i < GW && j < GH && !cl[j * GW + i];
    g.fillStyle = 'rgba(90,60,20,0.28)';
    for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
      if (!cl[j * GW + i]) continue;
      if (open(i, j + 1)) g.fillRect(i * CPX, (j + 1) * CPX, CPX, 9);
      if (open(i + 1, j)) g.fillRect((i + 1) * CPX, j * CPX, 6, CPX);
      if (open(i - 1, j)) g.fillRect(i * CPX - 6, j * CPX, 6, CPX);
    }
    g.fillStyle = '#ffffff';
    for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
      if (!cl[j * GW + i]) continue;
      if (open(i, j - 1)) g.fillRect(i * CPX - 2, j * CPX - 2, CPX + 4, 6);
      if (open(i, j + 1)) g.fillRect(i * CPX - 2, (j + 1) * CPX - 4, CPX + 4, 6);
      if (open(i - 1, j)) g.fillRect(i * CPX - 2, j * CPX - 2, 6, CPX + 4);
      if (open(i + 1, j)) g.fillRect((i + 1) * CPX - 4, j * CPX - 2, 6, CPX + 4);
    }
    if (reveal > 0) {
      g.globalAlpha = Math.min(1, reveal);
      g.drawImage(this.pic, 0, 0);
      g.globalAlpha = 1;
    }
    this.tex.needsUpdate = true;
  };

  // the beach ball: six bright panels and white caps
  let ballTex = null;
  function ballTexture() {
    if (ballTex) return ballTex;
    const [c, g] = G.makeCanvas(512, 256);
    const cols = ['#ff4b5c', '#ffffff', '#3d9bff', '#ffd23f', '#2fd6a2', '#ffffff'];
    for (let k = 0; k < 6; k++) { g.fillStyle = cols[k]; g.fillRect((k * 512) / 6, 0, 512 / 6 + 1, 256); }
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 512, 26);
    g.fillRect(0, 230, 512, 26);
    return (ballTex = G.toTexture(c));
  }

  // a soft round shadow
  let shadowTex = null;
  const shadowTexture = () => shadowTex || (shadowTex = G.radialTexture(64, [[0, 'rgba(30,20,10,0.55)'], [0.6, 'rgba(30,20,10,0.3)'], [1, 'rgba(30,20,10,0)']]));

  // a sparkle (bugs, the freeze)
  const sparkCache = {};
  function sparkTexture(color = '#ffffff') {
    if (sparkCache[color]) return sparkCache[color];
    const [c, g] = G.makeCanvas(64, 64);
    g.fillStyle = color;
    g.beginPath();
    for (let k = 0; k < 8; k++) { const r = k % 2 ? 7 : 30, a = (k * Math.PI) / 4; g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); }
    g.fill();
    return (sparkCache[color] = G.toTexture(c));
  }

  // a snowflake (the frozen ball)
  let flakeTex = null;
  function flakeTexture() {
    if (flakeTex) return flakeTex;
    const [c, g] = G.makeCanvas(64, 64);
    g.strokeStyle = '#ffffff';
    g.lineWidth = 5;
    g.lineCap = 'round';
    for (let k = 0; k < 3; k++) {
      const a = (k * Math.PI) / 3;
      g.beginPath();
      g.moveTo(32 - Math.cos(a) * 26, 32 - Math.sin(a) * 26);
      g.lineTo(32 + Math.cos(a) * 26, 32 + Math.sin(a) * 26);
      g.stroke();
    }
    return (flakeTex = G.toTexture(c));
  }

  // floating words ("+260", "BOING!"), already translated by the caller
  function textTexture(text, color = '#ffffff') {
    const [c, g] = G.makeCanvas(512, 128);
    g.font = `64px ${G.FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 12;
    g.strokeStyle = '#2a2238';
    g.strokeText(text, 256, 66);
    g.fillStyle = color;
    g.fillText(text, 256, 66);
    return G.toTexture(c);
  }

  FB.art = { CPX, PW, PH, picture, openField, FieldTexture, ballTexture, shadowTexture, sparkTexture, flakeTexture, textTexture, PICS };
})();
