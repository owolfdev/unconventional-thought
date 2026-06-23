import { EFFECT_IDS } from "@/lib/effects-catalog";

/** Resolve user input to a catalog effect id (exact, case-insensitive). */
export function resolveEffectId(raw: string): string | null {
  const normalized = raw.trim().toLowerCase().replace(/-/g, "_");
  return EFFECT_IDS.find((id) => id === normalized) ?? null;
}

/** Detailed help for @help effects / @help effect */
export function formatEffectsHelp(): string {
  const ids = EFFECT_IDS.map((id) => `  ${id}`).join("\n");
  return [
    "Effects catalog (ids from effects-catalog.ts):",
    ids,
    "",
    "Read current cue:",
    "  @effects",
    "",
    "Change stack (saved immediately):",
    "  @effect add film_scratches          current cue",
    "  @effect remove film_grain",
    "  @effect add all film_scratches       every cue in episode",
    "  @effect add even film_scratches      cue numbers 0, 2, 4, …",
    "  @effect add odd film_scratches       cue numbers 1, 3, 5, …",
    "  @effect add 0 10 film_scratches      cue range (inclusive)",
    "  @effect add 8 film_scratches         single cue by number",
  ].join("\n");
}

/** Apply add/remove to an effects list; returns null if id invalid or no-op. */
export function mutateEffectsList(
  effects: string[],
  action: "add" | "remove",
  id: string,
): { next: string[]; changed: boolean; message?: string } {
  if (action === "add") {
    if (effects.includes(id)) {
      return { next: effects, changed: false, message: `Already on stack: ${id}` };
    }
    return { next: [...effects, id], changed: true };
  }
  if (!effects.includes(id)) {
    return { next: effects, changed: false, message: `Not on stack: ${id}` };
  }
  return { next: effects.filter((e) => e !== id), changed: true };
}
