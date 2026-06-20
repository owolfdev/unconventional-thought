/** Accept `22`, `022`, `m22`, `m022` → canonical `m022`. */
export function normalizeCueId(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  const m = trimmed.match(/^m?(\d+)$/);
  if (!m) return raw.trim();
  return `m${m[1].padStart(3, "0")}`;
}

/** True if raw looks like a cue reference (digits, optional leading m). */
export function isCueRef(raw: string): boolean {
  return /^m?\d+$/i.test(raw.trim());
}

/** Display form without m prefix (no leading zeros): `m022` → `22`. */
export function formatCueLabel(id: string): string {
  const normalized = normalizeCueId(id);
  const m = normalized.match(/^m(\d+)$/i);
  if (!m) return id;
  return String(Number.parseInt(m[1], 10));
}

/** Episode title-card slot before VO (m000 / cue 0). */
export function isPrerollCue(item: { cue: number }): boolean {
  return item.cue === 0;
}

/** Header position: `preroll` for cue 0, else `{cue}/{total}` (e.g. `1/9`). */
export function formatCuePositionLabel(item: { cue: number }, total: number): string {
  if (isPrerollCue(item)) return "preroll";
  return `${item.cue}/${total}`;
}
