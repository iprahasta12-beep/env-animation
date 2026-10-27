/*  Spine 3.8 loader for file:// use.
 *  Browsers block fetch() from file://, so files come in by drag & drop
 *  (or the file picker) and are read with FileReader.
 *
 *  Accepts any mix of:  *.json | *.skel  +  *.atlas (*.atlas.txt)  +  page images (*.png / *.jpg / *.webp)
 *  Several skeletons can be dropped at once; each pairs with the atlas of the same base name
 *  (or the only atlas, if there is just one).
 */
(function () {
  'use strict';

  const base = (n) => n.replace(/^.*[\\/]/, '');
  const stem = (n) => base(n).replace(/\.atlas\.txt$/i, '').replace(/\.(json|skel|atlas|txt|png|jpe?g|webp)$/i, '');
  const ext = (n) => (/\.atlas\.txt$/i.test(n) ? 'atlas' : (n.split('.').pop() || '').toLowerCase());

  function read(file, how) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = () => rej(new Error('Cannot read ' + file.name));
      r[how](file);
    });
  }

  function loadImage(dataUrl) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => rej(new Error('Bad image'));
      img.src = dataUrl;
    });
  }

  function classify(files) {
    const out = { skeletons: [], atlases: [], images: [], configs: [], other: [] };
    return Promise.all(files.map(async (f) => {
      const e = ext(f.name);
      if (e === 'skel') out.skeletons.push({ name: stem(f.name), file: f, binary: true });
      else if (e === 'atlas') out.atlases.push({ name: stem(f.name), file: f });
      else if (['png', 'jpg', 'jpeg', 'webp'].includes(e)) out.images.push({ name: base(f.name).toLowerCase(), file: f });
      else if (e === 'json') {
        const txt = await read(f, 'readAsText');
        let j; try { j = JSON.parse(txt); } catch (err) { out.other.push(f.name + ' (invalid JSON)'); return; }
        if (j && j.skeleton && j.bones) out.skeletons.push({ name: stem(f.name), file: f, json: j });
        else if (j && (j.animations || j.skeletons)) out.configs.push(j);
        else out.other.push(f.name);
      } else out.other.push(f.name);
    })).then(() => out);
  }

  /**
   * @returns Promise<{ loaded:[{name, data, version}], configs:[obj], images:[], errors:[string] }>
   */
  async function loadFiles(fileList, opts) {
    const files = Array.from(fileList);
    const c = await classify(files);
    const errors = c.other.length ? ['Ignored: ' + c.other.join(', ')] : [];
    const loaded = [];
    const alphaMode = opts && opts.pma ? PIXI.ALPHA_MODES.PMA : PIXI.ALPHA_MODES.UNPACK;

    // image name -> File (match by file name, case-insensitive)
    const imgMap = {};
    c.images.forEach((i) => { imgMap[i.name] = i.file; });

    for (const sk of c.skeletons) {
      const atlasEntry = c.atlases.find((a) => a.name === sk.name) ||
        c.atlases.find((a) => sk.name.startsWith(a.name) || a.name.startsWith(sk.name)) ||
        (c.atlases.length === 1 ? c.atlases[0] : null);
      if (!atlasEntry) { errors.push(sk.name + ': no matching .atlas file dropped'); continue; }

      try {
        const atlasText = await read(atlasEntry.file, 'readAsText');
        const missing = [];
        const atlas = await new Promise((resolve, reject) => {
          const at = new PIXI.spine.TextureAtlas(atlasText, (pageName, cb) => {
            const f = imgMap[base(pageName).toLowerCase()];
            if (!f) { missing.push(pageName); cb(null); return; }
            read(f, 'readAsDataURL').then(loadImage).then((img) => {
              cb(PIXI.BaseTexture.from(img, { alphaMode }));
            }).catch(() => { missing.push(pageName); cb(null); });
          }, (a) => (a ? resolve(a) : reject(new Error('missing atlas page image: ' + missing.join(', ')))));
          void at;
        });
        if (missing.length) throw new Error('missing atlas page image: ' + missing.join(', '));

        const parser = new PIXI.spine.SpineParser();
        let data;
        if (sk.binary) {
          const buf = await read(sk.file, 'readAsArrayBuffer');
          data = parser.createBinaryParser().readSkeletonData(atlas, new Uint8Array(buf));
        } else {
          data = parser.createJsonParser().readSkeletonData(atlas, sk.json);
        }
        if (!data) throw new Error('could not parse skeleton');
        const ver = data.version || '?';
        if (!/^3\.8/.test(ver)) errors.push(sk.name + ': exported as Spine ' + ver + ' (viewer targets 3.8, may still work)');
        loaded.push({ name: sk.name, data, version: ver });
      } catch (err) {
        errors.push(sk.name + ': ' + (err && err.message ? err.message : err));
        console.error(err);
      }
    }

    if (!c.skeletons.length && c.atlases.length) errors.push('Atlas dropped without a .json/.skel skeleton');
    return { loaded, configs: c.configs, images: c.skeletons.length || c.atlases.length ? [] : c.images, errors };
  }

  window.SpineLoader = { loadFiles };
})();
