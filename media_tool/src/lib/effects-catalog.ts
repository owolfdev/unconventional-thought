/** IDs aligned with voicecut `effects` / `transition` (see tools/voicecut_schema.json).
 *  Add new ids here — @help effects and @effect add pick them up automatically. */
export const EFFECT_IDS = [
  "film_grain",
  "film_scratches",
  "film_damage",
  "vignette_soft",
  "vignette_heavy",
  "halftone_dots_light",
  "halftone_soft",
  "slow_zoom_in",
  "slow_zoom_out",
  "slow_push_in",
  "slow_scroll_up",
  "slow_spin",
  "tremble",
  "shake",
  "tilt_left",
  "tilt_right",
  "paper_texture",
  "desaturate_soft",
  "crt_glow",
] as const;

export const TRANSITION_IDS = [
  "none",
  "film_burn",
  "broken_film",
  "flame",
  "light_leak",
  "paper_flash",
] as const;

export type EffectId = (typeof EFFECT_IDS)[number];
export type TransitionId = (typeof TRANSITION_IDS)[number];
