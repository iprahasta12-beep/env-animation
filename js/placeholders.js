/*  Placeholder animations.
 *  Built from crops of the background so you can review motion/timing
 *  before the real Bone Studio (Spine 3.8) exports exist.
 *  When a loaded Spine animation has the SAME NAME, it replaces the placeholder.
 *
 *  All coordinates are in background-image pixels (1670 x 942).
 *  Each placeholder: { name, label, group, duration, container,
 *                      update(phase, dt, emitting), reset() }
 */
(function () {
  'use strict';
  const TAU = Math.PI * 2;

  // ---------- shared generated textures ----------
  function canvasTex(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    return PIXI.Texture.from(c);
  }

  function softTexture() {
    return canvasTex(64, 64, (g) => {
      const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      r.addColorStop(0, 'rgba(255,255,255,1)');
      r.addColorStop(0.45, 'rgba(255,255,255,0.55)');
      r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r; g.fillRect(0, 0, 64, 64);
    });
  }

  function tumbleweedTexture() {
    return canvasTex(72, 72, (g) => {
      let seed = 7;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      g.lineCap = 'round';
      for (let i = 0; i < 70; i++) {
        const a = rnd() * TAU, rr = 8 + rnd() * 24;
        g.strokeStyle = i % 3 ? 'rgba(150,104,52,0.95)' : 'rgba(214,166,98,1)';
        g.lineWidth = 2 + rnd() * 2.2;
        g.beginPath();
        g.arc(36 + Math.cos(a) * 4, 36 + Math.sin(a) * 4, rr, a, a + 0.6 + rnd() * 1.6);
        g.stroke();
      }
    });
  }

  // Tileable smooth value-noise for heat haze displacement.
  function noiseTexture() {
    const S = 256, G = 16;
    const grid = [];
    let seed = 42;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < G * G * 2; i++) grid.push(rnd());
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d');
    const img = g.createImageData(S, S);
    const sm = (t) => t * t * (3 - 2 * t);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const gx = x / S * G, gy = y / S * G;
      const x0 = Math.floor(gx), y0 = Math.floor(gy);
      const fx = sm(gx - x0), fy = sm(gy - y0);
      const x1 = (x0 + 1) % G, y1 = (y0 + 1) % G;
      const px = (ch) => {
        const v = (xx, yy) => grid[(yy * G + xx) * 2 + ch];
        const a = v(x0, y0) + (v(x1, y0) - v(x0, y0)) * fx;
        const b = v(x0, y1) + (v(x1, y1) - v(x0, y1)) * fx;
        return a + (b - a) * fy;
      };
      const i = (y * S + x) * 4;
      img.data[i] = px(0) * 255; img.data[i + 1] = px(1) * 255;
      img.data[i + 2] = 128; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const bt = PIXI.BaseTexture.from(c, { wrapMode: PIXI.WRAP_MODES.REPEAT });
    return new PIXI.Texture(bt);
  }

  // ---------- simple particle emitter ----------
  function Emitter(parent, tex, opts) {
    this.c = new PIXI.Container();
    parent.addChild(this.c);
    this.tex = tex; this.o = opts; this.acc = 0; this.pool = []; this.live = [];
  }
  Emitter.prototype.update = function (dt, emitting) {
    const o = this.o;
    if (emitting) {
      this.acc += dt * o.rate;
      while (this.acc >= 1) { this.acc -= 1; this.spawn(); }
    }
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i];
      p.age += dt;
      const k = p.age / p.life;
      if (k >= 1) { p.s.visible = false; this.pool.push(p); this.live.splice(i, 1); continue; }
      p.s.x += p.vx * dt; p.s.y += p.vy * dt;
      p.s.rotation += p.vr * dt;
      const sc = p.s0 + (p.s1 - p.s0) * k;
      p.s.scale.set(sc);
      const fadeIn = Math.min(1, k / 0.15);
      p.s.alpha = p.a * fadeIn * (1 - k) * (1 - k * 0.3);
    }
  };
  Emitter.prototype.spawn = function () {
    const o = this.o, R = (a, b) => a + Math.random() * (b - a);
    let p = this.pool.pop();
    if (!p) {
      const s = new PIXI.Sprite(this.tex);
      s.anchor.set(0.5);
      if (o.blend) s.blendMode = o.blend;
      this.c.addChild(s);
      p = { s };
    }
    p.s.visible = true; p.s.tint = o.tint;
    p.s.position.set(R(o.x[0], o.x[1]), R(o.y[0], o.y[1]));
    p.vx = R(o.vx[0], o.vx[1]); p.vy = R(o.vy[0], o.vy[1]); p.vr = R(-0.4, 0.4);
    p.life = R(o.life[0], o.life[1]); p.age = 0;
    p.s0 = R(o.s0[0], o.s0[1]); p.s1 = R(o.s1[0], o.s1[1]);
    p.a = R(o.alpha[0], o.alpha[1]);
    p.s.scale.set(p.s0); p.s.alpha = 0;
    this.live.push(p);
  };
  Emitter.prototype.clear = function () {
    this.live.forEach((p) => { p.s.visible = false; this.pool.push(p); });
    this.live = []; this.acc = 0;
  };
  // Pre-warm so smoke is already flowing on first frame.
  Emitter.prototype.warm = function (secs) {
    for (let t = 0; t < secs; t += 1 / 30) this.update(1 / 30, true);
  };

  // =====================================================================
  window.createPlaceholders = function (world, baseTex) {
    const soft = softTexture();
    const crop = (x, y, w, h) => new PIXI.Texture(baseTex, new PIXI.Rectangle(x, y, w, h));
    const list = [];
    const add = (o) => { o.container.name = o.name; world.addChild(o.container); list.push(o); return o; };

    // ---- rotating circular crop (fans, turbine, vents) ----
    function spinner(name, label, group, cx, cy, r, dur, revs, dir) {
      const c = new PIXI.Container();
      const s = new PIXI.Sprite(crop(cx - r, cy - r, r * 2, r * 2));
      s.anchor.set(0.5); s.position.set(cx, cy);
      const m = new PIXI.Graphics().beginFill(0xffffff).drawCircle(cx, cy, r).endFill();
      s.mask = m; c.addChild(s, m);
      return add({
        name, label, group, duration: dur, container: c,
        update(p) { s.rotation = dir * p * TAU * revs; },
        reset() { s.rotation = 0; }
      });
    }

    // ---- mesh plane over a rect, vertices displaced by fn ----
    function plane(x, y, w, h, cols, rows) {
      const pl = new PIXI.SimplePlane(crop(x, y, w, h), cols, rows);
      pl.position.set(x, y);
      const buf = pl.geometry.getBuffer('aVertexPosition');
      const base = Float32Array.from(buf.data);
      return { pl, buf, base };
    }

    // 1-2 DINER FANS
    spinner('diner_fan_left',  'Diner fan L', 'Diner', 1241, 140, 55, 1.6, 1, 1);
    spinner('diner_fan_right', 'Diner fan R', 'Diner', 1495, 141, 50, 1.4, 1, -1);

    // 4 DINER AWNING (bottom edge flutter, only pushes down so original never shows)
    (function () {
      const x = 1196, y = 262, w = 328, h = 74, cols = 24, rows = 4;
      const { pl, buf, base } = plane(x, y, w, h, cols, rows);
      const c = new PIXI.Container(); c.addChild(pl);
      add({
        name: 'diner_awning', label: 'Diner awning', group: 'Diner', duration: 2, container: c,
        update(p) {
          const d = buf.data;
          for (let r = 0; r < rows; r++) {
            const k = r / (rows - 1);           // 0 top (fixed) -> 1 bottom
            for (let q = 0; q < cols; q++) {
              const i = (r * cols + q) * 2;
              const vx = base[i];
              const wave = 0.5 + 0.5 * Math.sin(p * TAU - vx * 0.045);
              const gust = 0.5 + 0.5 * Math.sin(p * TAU * 2 + vx * 0.02);
              d[i + 1] = base[i + 1] + k * k * (2.5 + 4 * wave * gust);
              d[i] = vx + k * k * 1.5 * Math.sin(p * TAU + vx * 0.03);
            }
          }
          buf.update();
        },
        reset() { buf.data.set(base); buf.update(); }
      });
    })();

    // 5/7 SMOKE (wind blows to lower-right, same as windsock direction)
    function smoke(name, label, group, ox, oy, scale) {
      const c = new PIXI.Container();
      const e = new Emitter(c, soft, {
        rate: 10, tint: 0xd8d0c6,
        x: [ox - 4, ox + 4], y: [oy - 4, oy + 4],
        vx: [26, 44], vy: [8, 20], life: [2.4, 3.4],
        s0: [0.35 * scale, 0.5 * scale], s1: [1.8 * scale, 2.6 * scale], alpha: [0.7, 0.95]
      });
      e.warm(3);
      return add({
        name, label, group, duration: 3, container: c, emitter: e,
        update(p, dt, emitting) { e.update(dt, emitting); },
        reset() { e.clear(); e.warm(3); }
      });
    }
    smoke('diner_smoke', 'Diner chimney smoke', 'Diner', 1440, 47, 1.0);

    // 6 SHOP FAN
    spinner('shop_fan', 'Shop fan', 'Shop', 335, 654, 50, 1.2, 1, 1);
    smoke('shop_smoke', 'Shop pipe smoke', 'Shop', 393, 558, 0.75);

    // 8 TURBINE
    spinner('turbine_spin', 'Roof turbine', 'Shop', 188, 632, 61, 3, 1, -1);

    // 9 WINDSOCK (mesh wave along sock axis, pole stays fixed)
    (function () {
      const x = 14, y = 696, w = 244, h = 150, cols = 22, rows = 14;
      const { pl, buf, base } = plane(x, y, w, h, cols, rows);
      const c = new PIXI.Container(); c.addChild(pl);
      const px = 40 - x, py = 715 - y;                 // pivot (pole top) local
      const ax = 0.885, ay = 0.465, nx = -ay, ny = ax;  // sock axis / normal
      add({
        name: 'windsock', label: 'Windsock', group: 'Shop', duration: 1.6, container: c,
        update(p) {
          const d = buf.data;
          for (let i = 0; i < d.length; i += 2) {
            const dx = base[i] - px, dy = base[i + 1] - py;
            const along = dx * ax + dy * ay, perp = dx * nx + dy * ny;
            let f = Math.max(0, Math.min(1, (along - 12) / 200));
            const band = 1 - Math.max(0, Math.min(1, (Math.abs(perp) - 34) / 18));
            f = f * f * band;
            const wv = Math.sin(p * TAU - along * 0.045);
            const off = f * 6 * wv;
            const stretch = f * 3 * Math.sin(p * TAU * 2);
            d[i] = base[i] + nx * off + ax * stretch;
            d[i + 1] = base[i + 1] + ny * off + ay * stretch;
          }
          buf.update();
        },
        reset() { buf.data.set(base); buf.update(); }
      });
    })();

    // 10 ALARM LIGHT
    (function () {
      const cx = 607, cy = 683;
      const c = new PIXI.Container();
      const halo = new PIXI.Sprite(soft); halo.anchor.set(0.5); halo.position.set(cx, cy);
      halo.scale.set(1.4); halo.tint = 0xff2a1a; halo.blendMode = PIXI.BLEND_MODES.ADD;
      const core = new PIXI.Sprite(soft); core.anchor.set(0.5); core.position.set(cx, cy);
      core.scale.set(0.35); core.tint = 0xffd0b0; core.blendMode = PIXI.BLEND_MODES.ADD;
      c.addChild(halo, core);
      add({
        name: 'alarm_light', label: 'Alarm light', group: 'Shop', duration: 1, container: c,
        update(p) {
          const on = p < 0.5 ? Math.min(1, p / 0.05) : Math.max(0, 1 - (p - 0.5) / 0.08);
          halo.alpha = 0.9 * on; core.alpha = on;
        },
        reset() { halo.alpha = core.alpha = 0; }
      });
    })();

    // 11-12 ROOF VENTS
    spinner('roof_vent_top',    'Roof vent top',    'Roofs', 433, 115, 16, 1.0, 1, 1);
    spinner('roof_vent_bottom', 'Roof vent bottom', 'Roofs', 1333, 702, 25, 1.2, 1, -1);

    // 13 BIG TREES SWAY — only large vegetation. Mesh bend in wind direction
    //    (edges move more than center), gust wave travels across scene, leaf flutter.
    (function () {
      const T = [[55,25,45],[135,85,50],[55,170,55],[150,225,45],[1135,25,40],[1630,40,42],
        [35,570,40],[130,880,50],[255,890,45],[410,895,48],[550,890,45],
        [1050,650,45],[1150,600,45],[1615,545,45],[1045,770,40],
        [1150,895,50],[1320,895,50],[1475,895,40],[1580,860,55]];
      const WX = 0.885, WY = 0.465;          // wind dir (same as windsock)
      const N = 9;                           // mesh grid
      const c = new PIXI.Container();
      const trees = T.map(([x, y, r], i) => {
        const pad = Math.round(r * 0.15);
        const x0 = Math.max(0, x - r - pad), y0 = Math.max(0, y - r - pad);
        const x1 = Math.min(1670, x + r + pad), y1 = Math.min(942, y + r + pad);
        const pl = new PIXI.SimplePlane(crop(x0, y0, x1 - x0, y1 - y0), N, N);
        pl.position.set(x0, y0);
        const buf = pl.geometry.getBuffer('aVertexPosition');
        const base = Float32Array.from(buf.data);
        const lx = x - x0, ly = y - y0;
        // per-vertex weight: 0 at center (trunk), 1 at canopy edge
        const wgt = new Float32Array(base.length / 2);
        for (let v = 0; v < wgt.length; v++) {
          const d = Math.hypot(base[v * 2] - lx, base[v * 2 + 1] - ly) / r;
          wgt[v] = Math.min(1, d) ** 1.6;
        }
        const m = new PIXI.Graphics().beginFill(0xffffff).drawCircle(x, y, r * 1.02).endFill();
        pl.mask = m; c.addChild(pl, m);
        return { pl, buf, base, wgt, lx, ly, r,
          delay: x / 1670 * 0.6 + y / 942 * 0.15,     // gust reaches right side later
          ph: (i * 0.37) % 1, amp: r * 0.12 };
      });
      add({
        name: 'trees_sway', label: 'Big trees sway', group: 'Ambient', duration: 5, container: c,
        update(p) {
          trees.forEach((t) => {
            const q = (p - t.delay) * TAU;
            // gust: strong push + soft recoil, plus small idle sway
            const gust = Math.max(0, Math.sin(q)) ** 2 - 0.25 * Math.max(0, Math.sin(q - 1.4));
            const idle = 0.3 * Math.sin(q * 2 + t.ph * TAU);
            const lean = (gust + idle) * t.amp;
            const d = t.buf.data, b = t.base;
            for (let v = 0; v < t.wgt.length; v++) {
              const w = t.wgt[v], i2 = v * 2;
              const fl = Math.sin(q * 4 + b[i2] * 0.15 + b[i2 + 1] * 0.11) * 1.2 * w * (0.4 + gust);
              d[i2] = b[i2] + WX * lean * w + fl * -WY;
              d[i2 + 1] = b[i2 + 1] + WY * lean * w + fl * WX;
            }
            t.buf.update();
            t.pl.rotation = 0;
          });
        },
        reset() { trees.forEach((t) => { t.buf.data.set(t.base); t.buf.update(); }); }
      });
    })();

    // 14 DUST WIND
    (function () {
      const c = new PIXI.Container();
      const e = new Emitter(c, soft, {
        rate: 9, tint: 0xf0a456,
        x: [-120, -40], y: [300, 540],
        vx: [170, 260], vy: [8, 30], life: [7, 9],
        s0: [1.8, 2.6], s1: [4, 6], alpha: [0.3, 0.45]
      });
      e.warm(6);
      add({
        name: 'dust_wind', label: 'Dust wind', group: 'Ambient', duration: 4, container: c, emitter: e,
        update(p, dt, emitting) { e.update(dt, emitting); },
        reset() { e.clear(); e.warm(6); }
      });
    })();

    // 15 TUMBLEWEED
    (function () {
      const c = new PIXI.Container();
      const inner = new PIXI.Container();
      const shadow = new PIXI.Sprite(soft); shadow.anchor.set(0.5); shadow.tint = 0x1a120c;
      const tw = new PIXI.Sprite(tumbleweedTexture()); tw.anchor.set(0.5);
      inner.addChild(shadow, tw); c.addChild(inner);
      const travel = 0.8, x0 = -80, x1 = 1750, yBase = 455;
      add({
        name: 'tumbleweed', label: 'Tumbleweed', group: 'Ambient', duration: 9, container: c,
        update(p) {
          const k = Math.min(1, p / travel);
          const x = x0 + (x1 - x0) * k;
          const hop = Math.abs(Math.sin(k * TAU * 7));
          tw.position.set(x, yBase + Math.sin(k * TAU * 1.5) * 25 - hop * 10);
          tw.rotation = (x - x0) / 34;
          tw.scale.set(1.35 + hop * 0.15);
          shadow.position.set(x + 6 + hop * 8, yBase + Math.sin(k * TAU * 1.5) * 25 + 10 + hop * 4);
          shadow.width = 90 - hop * 16; shadow.height = 52 - hop * 10;
          shadow.alpha = 0.55 - hop * 0.2;
          inner.visible = k < 1;
        },
        reset() { inner.visible = true; }
      });
    })();

    // 16 HEAT HAZE (displacement over road crops)
    (function () {
      const c = new PIXI.Container();
      const disp = new PIXI.Sprite(noiseTexture());
      disp.renderable = false; disp.scale.set(2.5, 1.2);
      const filter = new PIXI.filters.DisplacementFilter(disp, 0);
      filter.scale.set(6, 3);
      [[0, 296, 1670, 244], [690, 0, 300, 296], [690, 540, 300, 402]].forEach(([x, y, w, h]) => {
        const s = new PIXI.Sprite(crop(x, y, w, h)); s.position.set(x, y);
        s.filters = [filter]; c.addChild(s);
      });
      c.addChild(disp);
      add({
        name: 'heat_haze', label: 'Heat haze', group: 'Ambient', duration: 3, container: c,
        update(p) { disp.x = p * 256 * disp.scale.x; disp.y = -p * 256 * disp.scale.y; },
        reset() { disp.position.set(0, 0); }
      });
    })();

    // heat haze sits under other overlays (right above the background)
    const haze = list.find((o) => o.name === 'heat_haze');
    world.setChildIndex(haze.container, 1);
    return list;
  };
})();
