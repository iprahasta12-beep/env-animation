/* Stake Review — offline PixiJS animation reviewer (PixiJS 6 + pixi-spine 3.8 runtime) */
(function () {
  'use strict';

  // ---------------- config ----------------
  const USER = window.REVIEW_CONFIG || {};
  const CFG = {
    autoPlay: USER.autoPlay !== false,
    loop: USER.loop !== false,
    stage: Object.assign({ width: 1920, height: 1080 }, USER.stage),
    animations: Object.assign({}, USER.animations),
    skeletons: Object.assign({}, USER.skeletons),
    spinePremultipliedAlpha: !!USER.spinePremultipliedAlpha
  };
  const W = CFG.stage.width, H = CFG.stage.height;

  // ---------------- state ----------------
  const S = {
    playing: CFG.autoPlay,
    loop: CFG.loop,
    time: 0,
    items: [],          // { id, name, label, group, kind:'ph'|'spine', enabled, lt, ph?, sk?, track? }
    skeletons: [],      // { name, spine, data, anims, x, y, scale, skin, items }
    selected: null
  };

  const $ = (s) => document.querySelector(s);
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };

  // ---------------- pixi ----------------
  const app = new PIXI.Application({
    width: W, height: H, backgroundColor: 0x120e0b, antialias: true, resolution: 1
  });
  $('#stage').appendChild(app.view);

  function fit() {
    const wrap = $('#stage');
    const s = Math.min(wrap.clientWidth / W, wrap.clientHeight / H);
    app.view.style.width = Math.floor(W * s) + 'px';
    app.view.style.height = Math.floor(H * s) + 'px';
  }
  window.addEventListener('resize', fit);

  const world = new PIXI.Container();        // background-space (1670x942 scaled to cover 1920x1080)
  const spineLayer = new PIXI.Container();   // stage-space (1920x1080)
  app.stage.addChild(world, spineLayer);

  let bgSprite = null;

  function loadBackground(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(PIXI.BaseTexture.from(img));
      img.onerror = () => reject(new Error('background failed to load'));
      img.src = url;
    });
  }

  function layoutBackground(bt) {
    const s = Math.max(W / bt.width, H / bt.height);
    world.scale.set(s);
    world.position.set((W - bt.width * s) / 2, (H - bt.height * s) / 2);
  }

  // ---------------- placeholders ----------------
  function initPlaceholders(bt) {
    const list = window.createPlaceholders(world, bt);
    list.forEach((ph) => {
      const enabled = ph.name in CFG.animations ? !!CFG.animations[ph.name] : true;
      S.items.push({ id: 'ph:' + ph.name, name: ph.name, label: ph.label, group: ph.group, kind: 'ph', enabled, lt: 0, ph, replaced: false });
    });
    S.items.forEach((it) => { it.ph.container.visible = it.enabled; it.ph.update(0, 0, false); });
  }

  function phase(it) {
    const d = it.ph.duration;
    return S.loop ? (it.lt % d) / d : Math.min(it.lt / d, 1);
  }

  // ---------------- spine ----------------
  function addSkeleton(rec) {
    // replace an already loaded skeleton with the same name
    const old = S.skeletons.find((s) => s.name === rec.name);
    if (old) removeSkeleton(old);

    const spine = new PIXI.spine.Spine(rec.data);
    spine.autoUpdate = false;
    const conf = CFG.skeletons[rec.name] || {};
    const sk = {
      name: rec.name, spine, data: rec.data, version: rec.version,
      x: conf.x != null ? conf.x : W / 2, y: conf.y != null ? conf.y : H / 2,
      scale: conf.scale != null ? conf.scale : 1,
      skin: conf.skin || null, items: []
    };
    const skins = rec.data.skins.map((s) => s.name);
    if (!sk.skin || !skins.includes(sk.skin)) {
      // default skin may be empty in skin-based rigs: pick first skin that has attachments
      sk.skin = rec.data.defaultSkin ? rec.data.defaultSkin.name : skins[0];
    }
    applySkin(sk);
    applyTransform(sk);
    spineLayer.addChild(spine);
    S.skeletons.push(sk);

    rec.data.animations.forEach((a, i) => {
      const prev = S.items.find((it) => it.kind === 'ph' && it.name === a.name);
      let enabled = a.name in CFG.animations ? !!CFG.animations[a.name] : true;
      if (prev) { enabled = prev.enabled; prev.replaced = true; prev.ph.container.visible = false; }
      const it = { id: 'sp:' + rec.name + ':' + a.name, name: a.name, label: a.name, group: 'Spine · ' + rec.name,
        kind: 'spine', enabled, lt: 0, sk, track: i, duration: a.duration };
      sk.items.push(it);
      S.items.push(it);
    });
    restartSkeleton(sk);
    S.selected = sk;
  }

  function removeSkeleton(sk) {
    spineLayer.removeChild(sk.spine);
    sk.spine.destroy({ children: true });
    S.items = S.items.filter((it) => it.sk !== sk);
    S.skeletons = S.skeletons.filter((s) => s !== sk);
    // un-replace placeholders
    S.items.forEach((it) => {
      if (it.kind === 'ph' && it.replaced && !S.items.some((o) => o.kind === 'spine' && o.name === it.name)) {
        it.replaced = false; it.ph.container.visible = it.enabled;
      }
    });
    if (S.selected === sk) S.selected = S.skeletons[0] || null;
  }

  function applySkin(sk) {
    const k = sk.spine.skeleton;
    try { k.setSkinByName(sk.skin); k.setSlotsToSetupPose(); } catch (e) { /* no skin */ }
  }
  function applyTransform(sk) {
    sk.spine.position.set(sk.x, sk.y);
    sk.spine.scale.set(sk.scale);
  }

  function restartSkeleton(sk) {
    const st = sk.spine.state;
    st.clearTracks();
    sk.spine.skeleton.setToSetupPose();
    sk.items.forEach((it) => { if (it.enabled) st.setAnimation(it.track, it.name, S.loop); it.lt = 0; });
    sk.spine.update(0);
  }

  function setSpineEnabled(it, on) {
    const st = it.sk.spine.state;
    if (on) st.setAnimation(it.track, it.name, S.loop);
    else st.setEmptyAnimation(it.track, 0.1);
    it.sk.spine.update(0);
  }

  // ---------------- transport ----------------
  function setPlaying(p) { S.playing = p; renderTransport(); }
  function setLoop(l) {
    S.loop = l;
    S.skeletons.forEach((sk) => sk.spine.state.tracks.forEach((t) => { if (t && t.animation && t.animation.name !== '<empty>') t.loop = l; }));
    if (l) S.items.forEach((it) => { if (it.kind === 'ph') it.lt = it.lt % it.ph.duration; });
    renderTransport();
  }
  function restart() {
    S.time = 0;
    S.items.forEach((it) => { if (it.kind === 'ph') { it.lt = 0; it.ph.reset(); it.ph.update(0, 0, false); } });
    S.skeletons.forEach(restartSkeleton);
  }

  function setEnabled(it, on) {
    it.enabled = on;
    it.lt = 0;
    if (it.kind === 'ph') {
      it.ph.reset();
      it.ph.container.visible = on && !it.replaced;
      it.ph.update(0, 0, false);
    } else setSpineEnabled(it, on);
    syncRow(it);
  }

  // ---------------- tick ----------------
  let fpsAcc = 0, fpsN = 0, fpsShown = 0;
  app.ticker.add(() => {
    const raw = Math.min(app.ticker.deltaMS / 1000, 0.1);
    fpsAcc += raw; fpsN++;
    if (fpsAcc > 0.5) { fpsShown = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; }
    const dt = S.playing ? raw : 0;
    S.time += dt;
    if (dt > 0) {
      for (const it of S.items) {
        if (it.kind !== 'ph' || !it.enabled || it.replaced) continue;
        it.lt += dt;
        const emitting = S.loop || it.lt < it.ph.duration;
        it.ph.update(phase(it), dt, emitting);
      }
      S.skeletons.forEach((sk) => sk.spine.update(dt));
    }
    $('#clock').textContent = S.time.toFixed(1) + 's · ' + fpsShown + ' fps';
  });

  // ---------------- UI ----------------
  const rows = new Map();

  function renderTransport() {
    const pb = $('#btn-play');
    pb.innerHTML = S.playing ? ICON.pause : ICON.play;
    pb.title = S.playing ? 'Pause (Space)' : 'Play (Space)';
    pb.classList.toggle('on', S.playing);
    $('#btn-loop').classList.toggle('on', S.loop);
    $('#btn-loop').setAttribute('aria-pressed', S.loop);
    $('#loop-state').textContent = S.loop ? 'Loop' : 'Once';
  }

  function syncRow(it) {
    const r = rows.get(it.id);
    if (r) { r.input.checked = it.enabled; r.row.classList.toggle('off', !it.enabled); }
    renderCount();
  }

  function renderCount() {
    const vis = S.items.filter((i) => !(i.kind === 'ph' && i.replaced));
    $('#count').textContent = vis.filter((i) => i.enabled).length + ' / ' + vis.length + ' on';
  }

  function renderList() {
    const list = $('#anim-list');
    list.innerHTML = '';
    rows.clear();
    const groups = {};
    S.items.forEach((it) => {
      if (it.kind === 'ph' && it.replaced) return;
      (groups[it.group] = groups[it.group] || []).push(it);
    });
    Object.keys(groups).forEach((g) => {
      const sec = el('section', 'grp');
      const head = el('div', 'grp-head');
      head.appendChild(el('span', 'grp-name', g));
      const gAll = el('button', 'mini', 'all');
      const gNone = el('button', 'mini', 'none');
      gAll.onclick = () => groups[g].forEach((it) => setEnabled(it, true));
      gNone.onclick = () => groups[g].forEach((it) => setEnabled(it, false));
      head.append(gAll, gNone);
      sec.appendChild(head);
      groups[g].forEach((it) => {
        const row = el('label', 'row' + (it.enabled ? '' : ' off'));
        const input = el('input'); input.type = 'checkbox'; input.checked = it.enabled;
        input.onchange = () => setEnabled(it, input.checked);
        const sw = el('span', 'sw');
        const txt = el('span', 'nm', it.name);
        const tag = el('span', 'tag', it.kind === 'spine' ? 'spine' : 'demo');
        if (it.kind === 'spine') tag.classList.add('sp');
        row.append(input, sw, txt, tag);
        sec.appendChild(row);
        rows.set(it.id, { row, input });
      });
      list.appendChild(sec);
    });
    renderCount();
    renderSkeletons();
  }

  function renderSkeletons() {
    const box = $('#sk-list');
    box.innerHTML = '';
    S.skeletons.forEach((sk) => {
      const card = el('div', 'sk' + (S.selected === sk ? ' sel' : ''));
      card.onclick = (e) => { if (e.target === card || e.target.classList.contains('sk-title')) { S.selected = sk; renderSkeletons(); } };
      const t = el('div', 'sk-title');
      t.appendChild(el('b', null, sk.name));
      t.appendChild(el('span', 'ver', 'v' + sk.version));
      const rm = el('button', 'mini danger', 'remove');
      rm.onclick = () => { removeSkeleton(sk); renderList(); };
      t.appendChild(rm);
      card.appendChild(t);
      const grid = el('div', 'sk-grid');
      [['x', 1], ['y', 1], ['scale', 0.05]].forEach(([k, step]) => {
        const lab = el('label', 'num');
        lab.appendChild(el('span', null, k));
        const inp = el('input'); inp.type = 'number'; inp.step = step; inp.value = +(+sk[k]).toFixed(3);
        inp.oninput = () => { const v = parseFloat(inp.value); if (!isNaN(v)) { sk[k] = v; applyTransform(sk); } };
        inp.dataset.k = k;
        lab.appendChild(inp);
        grid.appendChild(lab);
      });
      const skins = sk.data.skins.map((s) => s.name);
      if (skins.length > 1) {
        const lab = el('label', 'num wide');
        lab.appendChild(el('span', null, 'skin'));
        const sel = el('select');
        skins.forEach((n) => { const o = el('option', null, n); o.value = n; if (n === sk.skin) o.selected = true; sel.appendChild(o); });
        sel.onchange = () => { sk.skin = sel.value; applySkin(sk); };
        lab.appendChild(sel);
        grid.appendChild(lab);
      }
      card.appendChild(grid);
      box.appendChild(card);
    });
    $('#sk-hint').style.display = S.skeletons.length ? '' : 'none';
  }

  function syncSkeletonInputs(sk) {
    document.querySelectorAll('.sk.sel input[data-k]').forEach((inp) => { inp.value = +(+sk[inp.dataset.k]).toFixed(3); });
  }

  // ---------------- shift-drag selected skeleton ----------------
  app.stage.interactive = true;
  app.stage.hitArea = new PIXI.Rectangle(0, 0, W, H);
  let drag = null;
  app.stage.on('pointerdown', (e) => {
    if (!S.selected || !e.data.originalEvent.shiftKey) return;
    const p = e.data.global;
    drag = { sx: p.x, sy: p.y, x: S.selected.x, y: S.selected.y };
  });
  app.stage.on('pointermove', (e) => {
    if (!drag || !S.selected) return;
    const p = e.data.global;
    S.selected.x = Math.round(drag.x + p.x - drag.sx);
    S.selected.y = Math.round(drag.y + p.y - drag.sy);
    applyTransform(S.selected);
    syncSkeletonInputs(S.selected);
  });
  const endDrag = () => { drag = null; };
  app.stage.on('pointerup', endDrag);
  app.stage.on('pointerupoutside', endDrag);

  // ---------------- file drop ----------------
  function toast(msg, kind) {
    const t = el('div', 'toast ' + (kind || ''), msg);
    $('#toasts').appendChild(t);
    setTimeout(() => t.classList.add('out'), kind === 'err' ? 6000 : 3000);
    setTimeout(() => t.remove(), kind === 'err' ? 6600 : 3600);
  }

  async function handleFiles(files) {
    if (!files || !files.length) return;
    const res = await window.SpineLoader.loadFiles(files, { pma: $('#pma').checked });
    res.configs.forEach(importConfig);
    res.loaded.forEach((rec) => { addSkeleton(rec); toast('Loaded ' + rec.name + ' · ' + rec.data.animations.length + ' animations'); });
    if (res.images.length === 1 && !res.loaded.length) {
      const f = res.images[0].file;
      const r = new FileReader();
      r.onload = async () => {
        const bt = await loadBackground(r.result);
        bgSprite.texture = new PIXI.Texture(bt);
        layoutBackground(bt);
        toast('Background replaced for this session (demo animations are aligned to the original background)');
      };
      r.readAsDataURL(f);
    }
    res.errors.forEach((e) => toast(e, 'err'));
    renderList();
  }

  let dragDepth = 0;
  window.addEventListener('dragenter', (e) => { e.preventDefault(); dragDepth++; document.body.classList.add('dragging'); });
  window.addEventListener('dragleave', (e) => { e.preventDefault(); if (--dragDepth <= 0) { dragDepth = 0; document.body.classList.remove('dragging'); } });
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => {
    e.preventDefault(); dragDepth = 0; document.body.classList.remove('dragging');
    handleFiles(e.dataTransfer.files);
  });
  $('#file-input').addEventListener('change', (e) => { handleFiles(e.target.files); e.target.value = ''; });

  // ---------------- config export / import ----------------
  function currentConfig() {
    const animations = {};
    S.items.forEach((it) => { if (!(it.kind === 'ph' && it.replaced)) animations[it.name] = it.enabled; });
    const skeletons = Object.assign({}, CFG.skeletons);
    S.skeletons.forEach((sk) => { skeletons[sk.name] = { x: sk.x, y: sk.y, scale: sk.scale, skin: sk.skin }; });
    return { autoPlay: CFG.autoPlay, loop: S.loop, stage: { width: W, height: H },
      spinePremultipliedAlpha: $('#pma').checked, animations, skeletons };
  }

  function download(name, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function exportJs() {
    const c = currentConfig();
    const body = JSON.stringify(c, null, 2).replace(/"([a-zA-Z_$][\w$]*)":/g, '$1:');
    download('config.js',
      '// Stake Review — animation config (exported ' + new Date().toISOString().slice(0, 16).replace('T', ' ') + ')\n' +
      '// Replace config.js next to index.html with this file, then reload.\n' +
      'window.REVIEW_CONFIG = ' + body + ';\n', 'text/javascript');
    toast('config.js exported');
  }
  function exportJson() {
    download('config.json', JSON.stringify(currentConfig(), null, 2) + '\n', 'application/json');
    toast('config.json exported');
  }

  function importConfig(c) {
    if (typeof c.loop === 'boolean') setLoop(c.loop);
    if (c.animations) S.items.forEach((it) => { if (it.name in c.animations) setEnabled(it, !!c.animations[it.name]); });
    if (c.skeletons) {
      Object.assign(CFG.skeletons, c.skeletons);
      S.skeletons.forEach((sk) => {
        const k = c.skeletons[sk.name]; if (!k) return;
        ['x', 'y', 'scale'].forEach((p) => { if (k[p] != null) sk[p] = k[p]; });
        if (k.skin) { sk.skin = k.skin; applySkin(sk); }
        applyTransform(sk);
      });
    }
    toast('Config imported');
  }

  // ---------------- wire buttons ----------------
  const ICON = {
    play: '<svg viewBox="0 0 24 24"><path d="M7 5l12 7-12 7z"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>'
  };
  $('#btn-play').onclick = () => setPlaying(!S.playing);
  $('#btn-restart').onclick = restart;
  $('#btn-loop').onclick = () => setLoop(!S.loop);
  $('#btn-all').onclick = () => S.items.forEach((it) => { if (!(it.kind === 'ph' && it.replaced)) setEnabled(it, true); });
  $('#btn-none').onclick = () => S.items.forEach((it) => { if (!(it.kind === 'ph' && it.replaced)) setEnabled(it, false); });
  $('#btn-js').onclick = exportJs;
  $('#btn-json').onclick = exportJson;
  $('#btn-panel').onclick = () => document.body.classList.toggle('panel-hidden');
  $('#pma').checked = CFG.spinePremultipliedAlpha;

  window.addEventListener('keydown', (e) => {
    if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.code === 'Space') { e.preventDefault(); setPlaying(!S.playing); }
    else if (e.code === 'KeyR') restart();
    else if (e.code === 'KeyL') setLoop(!S.loop);
    else if (e.code === 'KeyH') document.body.classList.toggle('panel-hidden');
  });

  // ---------------- boot ----------------
  (async function boot() {
    fit();
    renderTransport();
    try {
      if (!window.BG_DATA_URL) throw new Error('assets/background.js missing');
      const bt = await loadBackground(window.BG_DATA_URL);
      bgSprite = new PIXI.Sprite(new PIXI.Texture(bt));
      world.addChild(bgSprite);
      layoutBackground(bt);
      initPlaceholders(bt);
    } catch (err) {
      console.error(err);
      toast(err.message, 'err');
    }
    renderList();
    window.__review = { app, S, restart, setLoop, setPlaying, setEnabled, handleFiles, currentConfig };
  })();
})();
