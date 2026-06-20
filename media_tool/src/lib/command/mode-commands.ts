import type { ItemAcquisition, TextGraphic } from "@/lib/types";
import {
  VISUAL_MODES,
  VISUAL_MODE_LABELS,
  normalizeVisualMode,
  type VisualMode,
} from "@/lib/visual-modes";

type ManifestModeDefaults = {
  text_graphic?: TextGraphic | null;
};

const MODE_ALIASES: Record<string, VisualMode> = {
  historical: "historical",
  historical_photo: "historical",
  archive: "historical",
  stock: "stock",
  broll: "stock",
  artifact: "artifact",
  text_graphic: "text_graphic",
  text: "text_graphic",
  typography: "text_graphic",
  effect_only: "effect_only",
  effect: "effect_only",
  fx: "effect_only",
};

/** Resolve @mode argument to a canonical visual mode. */
export function resolveVisualModeArg(raw: string): VisualMode | null {
  const key = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (MODE_ALIASES[key]) return MODE_ALIASES[key];
  if (VISUAL_MODES.includes(key as VisualMode)) return key as VisualMode;
  return null;
}

/** Match legacy ReviewWorkspace visual mode dropdown side effects. */
export function applyVisualModeChange(
  acq: ItemAcquisition,
  mode: VisualMode,
  manifestItem?: ManifestModeDefaults,
): ItemAcquisition {
  const current = normalizeVisualMode(acq.resolved_visual_mode);
  const text_graphic =
    mode === "text_graphic"
      ? acq.text_graphic ?? manifestItem?.text_graphic ?? null
      : null;
  const text_graphic_layer =
    mode === "text_graphic" || mode === "effect_only"
      ? null
      : acq.text_graphic_layer;
  const status =
    mode === "text_graphic"
      ? "text_graphic"
      : mode === "effect_only"
        ? "in_progress"
        : acq.status === "text_graphic"
          ? "in_progress"
          : acq.status;
  const resolved_media_type =
    mode === "text_graphic" || mode === "effect_only"
      ? "generated"
      : acq.resolved_media_type;

  if (
    current === mode &&
    acq.text_graphic === text_graphic &&
    acq.text_graphic_layer === text_graphic_layer &&
    acq.status === status &&
    acq.resolved_media_type === resolved_media_type
  ) {
    return acq;
  }

  return {
    ...acq,
    resolved_visual_mode: mode,
    text_graphic,
    text_graphic_layer,
    status,
    resolved_media_type,
    updated_at: new Date().toISOString(),
  };
}

export function formatModesHelp(): string {
  const modes = VISUAL_MODES.map(
    (id) => `  ${id.padEnd(14)} ${VISUAL_MODE_LABELS[id]}`,
  ).join("\n");
  return [
    "Visual modes:",
    modes,
    "",
    "Aliases: text → text_graphic · effect, fx → effect_only · archive → historical",
    "",
    "Read current cue:",
    "  @mode",
    "",
    "Change (saved immediately):",
    "  @mode effect_only",
    "  @mode historical",
    "",
    "Resolved mode drives Remotion render. Leaving text_graphic clears full-cue typography.",
  ].join("\n");
}

export function formatCurrentMode(acq: ItemAcquisition): string {
  const mode = normalizeVisualMode(acq.resolved_visual_mode);
  return [
    `Visual mode: ${VISUAL_MODE_LABELS[mode]}`,
    `id: ${mode}`,
    `media type: ${acq.resolved_media_type}`,
    `status: ${acq.status}`,
  ].join("\n");
}
