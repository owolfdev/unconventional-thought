/** Canonical visual modes (editorial category — pair with photo / video / generated). */
export const VISUAL_MODES = [
  "historical",
  "stock",
  "artifact",
  "text_graphic",
  "effect_only",
] as const;

export type VisualMode = (typeof VISUAL_MODES)[number];

/** Legacy value from media_search v3 — normalized to `historical` on load/save. */
export type LegacyVisualMode = "historical_photo";

export const VISUAL_MODE_LABELS: Record<VisualMode, string> = {
  historical: "Historical — archive (people, era, events)",
  stock: "Stock — generic / licensed B-roll",
  artifact: "Artifact — story object (vinyl, disc, shirt…)",
  text_graphic: "Text graphic",
  effect_only: "Effect only (blank + FX)",
};

export function normalizeVisualMode(mode: string): VisualMode {
  if (mode === "historical_photo") return "historical";
  if (VISUAL_MODES.includes(mode as VisualMode)) return mode as VisualMode;
  return "historical";
}

export function isVisualMode(mode: string): mode is VisualMode {
  return VISUAL_MODES.includes(mode as VisualMode);
}

/** Cues that need archive search + acquired files (not typography / FX-only). */
export function needsArchiveSearch(mode: string): boolean {
  const m = normalizeVisualMode(mode);
  return m === "historical" || m === "stock" || m === "artifact";
}

export function requiresAcquiredMedia(mode: string): boolean {
  return needsArchiveSearch(mode);
}

type VisualModeFields = {
  source_visual_mode: string;
  resolved_visual_mode: string;
};

export function normalizeItemAcquisition<T extends VisualModeFields>(acq: T): T {
  return {
    ...acq,
    source_visual_mode: normalizeVisualMode(acq.source_visual_mode),
    resolved_visual_mode: normalizeVisualMode(acq.resolved_visual_mode),
  };
}

export function normalizeAcquisitionDocument<
  T extends { items: Record<string, VisualModeFields> },
>(doc: T): T {
  const items: Record<string, VisualModeFields> = {};
  for (const [id, acq] of Object.entries(doc.items)) {
    items[id] = normalizeItemAcquisition(acq);
  }
  return { ...doc, items };
}
