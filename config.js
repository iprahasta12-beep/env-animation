// =============================================================
//  Stake Review — animation config
//  Edit true/false to turn animations on/off, then reload page.
//  Or toggle live in the viewer and click "Export config.js".
// =============================================================
window.REVIEW_CONFIG = {
  autoPlay: true,          // start playing on load
  loop: true,              // global loop (false = play each animation once)
  stage: { width: 1920, height: 1080 },

  animations: {
    // --- Diner (top-right) ---
    diner_fan_left:     true,
    diner_fan_right:    true,
    diner_awning:       true,
    diner_smoke:        true,

    // --- Shop (bottom-left) ---
    shop_fan:           true,
    shop_smoke:         true,
    turbine_spin:       true,
    windsock:           true,
    alarm_light:        true,

    // --- Roofs ---
    roof_vent_top:      true,
    roof_vent_bottom:   true,

    // --- Ambient ---
    trees_sway:         true,
    dust_wind:          false,
    tumbleweed:         false,
    heat_haze:          false

    // Spine animations you load also appear here by name, e.g.:
    // idle: true,
  },

  // Position/scale of loaded Spine skeletons (stage pixels, 1920x1080).
  // Key = skeleton file name without extension.
  skeletons: {
    // "diner": { x: 960, y: 540, scale: 1, skin: "default" }
  }
};
