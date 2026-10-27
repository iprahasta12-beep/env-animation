# Stake Review — offline PixiJS animation viewer

Double-click `index.html`. No server, no internet.
PixiJS 6.5.10 + pixi-spine 3.1.2 (Spine **3.8** runtime) bundled in `lib/`.
Stage 1920×1080.

## Folder
```
index.html                  viewer
config.js                   animation on/off config  <- edit this
assets/background.png       original background
assets/background.js        same image embedded (file:// needs this)
js/app.js                   viewer logic
js/placeholders.js          16 demo animations (made from bg crops)
js/spine-loader.js          Spine 3.8 drag & drop loader
lib/                        PixiJS + pixi-spine
tools/background-to-js.html convert new bg PNG -> assets/background.js
```

## Controls
| Key | Action |
|---|---|
| Space | Play / pause |
| R | Restart all |
| L | Loop on/off (off = each animation plays once, holds last frame) |
| H | Hide panel |
| Shift + drag | Move selected Spine skeleton |

Auto play on load (`autoPlay: true` in config).

## Config on/off
`config.js` -> `animations: { name: true/false }`. Reload page.
Or toggle live in panel -> **Export config.js** -> replace file.
**Export config.json** = same data as JSON (for game code / Stake build).
Drop a `config.json` on viewer = import.

## Load Bone Studio (Spine 3.8) export
Drag in together (or click drop box):
- `name.json` **or** `name.skel`
- `name.atlas`
- page image(s) named in atlas (`name.png`, `name2.png`, ...)

Several skeletons at once OK (paired by file name).
Each animation in skeleton = own toggle, runs on own track (so element animations play together).
**Name a Spine animation same as demo (e.g. `diner_fan_left`) -> replaces demo automatically.**
Position/scale/skin per skeleton saved in exported config under `skeletons`.

Export from Spine 3.8: JSON or Binary, Texture Atlas packed.
If atlas exported with **Premultiply alpha** -> tick "Atlas uses premultiplied alpha" **before** dropping (dark/white fringes = wrong setting).

## Demo animation list
| Name | Element | Default |
|---|---|---|
| diner_fan_left | Diner left AC fan | on |
| diner_fan_right | Diner right AC fan | on |
| diner_awning | Awning flutter | on |
| diner_smoke | Diner chimney smoke | on |
| shop_fan | Shop AC fan | on |
| shop_smoke | Shop pipe smoke | on |
| turbine_spin | Orange roof turbine | on |
| windsock | Windsock wave | on |
| alarm_light | Red light blink | on |
| roof_vent_top | Top-left roof vent | on |
| roof_vent_bottom | Bottom-right roof vent | on |
| trees_sway | Big trees only (wind gust + leaf flutter) | on |
| dust_wind | Dust across road | off |
| tumbleweed | Tumbleweed roll | off |
| heat_haze | Road shimmer | off |

Demo = reference for motion/timing only. Real art comes from Spine.

## Why drag & drop (not auto-load)?
Browsers block `fetch()` of local files from `file://`. Scripts (`<script src>`) are allowed,
so config + background are `.js`; Spine files are read via drag & drop.
Want auto-load from folder? Run `npx serve .` and ask for folder-loading version.
