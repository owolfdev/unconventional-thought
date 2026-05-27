/** Default plate / letterbox fill for Remotion and effect-only cues. */
export const DEFAULT_BACKGROUND_COLOR = "#000000";

export const BACKGROUND_COLOR_PRESETS: Array<{ label: string; value: string }> =
  [
    { label: "Black", value: "#000000" },
    { label: "Near black", value: "#0a0a0a" },
    { label: "Charcoal", value: "#1a1a1a" },
    { label: "White", value: "#ffffff" },
  ];

/** Normalize user input to #RRGGBB (lowercase). */
export function normalizeBackgroundColor(value: string | undefined | null): string {
  if (!value?.trim()) return DEFAULT_BACKGROUND_COLOR;
  const v = value.trim().toLowerCase();
  if (v === "black") return "#000000";
  if (v === "white") return "#ffffff";
  if (/^#[0-9a-f]{6}$/i.test(v)) return v;
  if (/^#[0-9a-f]{3}$/i.test(v)) {
    const [, r, g, b] = v.match(/^#(.)(.)(.)$/) ?? [];
    if (r && g && b) return `#${r}${r}${g}${g}${b}${b}`;
  }
  if (/^[0-9a-f]{6}$/i.test(v)) return `#${v}`;
  return DEFAULT_BACKGROUND_COLOR;
}
