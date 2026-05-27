"use client";

import { EFFECT_IDS, TRANSITION_IDS } from "@/lib/effects-catalog";

interface Props {
  effects: string[];
  transition: string | null;
  onEffectsChange: (effects: string[]) => void;
  onTransitionChange: (transition: string | null) => void;
  /** When true, emphasize that no still/video is required */
  effectOnly?: boolean;
}

export function EffectsPanel({
  effects,
  transition,
  onEffectsChange,
  onTransitionChange,
  effectOnly = false,
}: Props) {
  const toggle = (id: string) => {
    if (effects.includes(id)) {
      onEffectsChange(effects.filter((e) => e !== id));
    } else {
      onEffectsChange([...effects, id]);
    }
  };

  return (
    <div
      className={`mt-4 space-y-3 rounded-lg border p-3 text-sm ${
        effectOnly
          ? "border-sky-900/50 bg-sky-950/25"
          : "border-zinc-700/80 bg-zinc-950/50"
      }`}
    >
      <div>
        <p
          className={
            effectOnly ? "font-medium text-sky-200" : "font-medium text-zinc-300"
          }
        >
          {effectOnly ? "Effect-only beat (no photo/video)" : "Layer effects"}
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Maps to voicecut{" "}
          <code className="text-zinc-400">effects</code> and{" "}
          <code className="text-zinc-400">transition</code>. Use{" "}
          <strong className="font-normal text-zinc-400">Notes</strong> for extra
          direction (e.g. &ldquo;black plate only&rdquo;).
        </p>
      </div>

      <label className="block text-xs">
        <span className="text-zinc-500">Transition in</span>
        <select
          className="mt-1 w-full max-w-xs rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5"
          value={transition ?? "none"}
          onChange={(e) =>
            onTransitionChange(
              e.target.value === "none" ? null : e.target.value,
            )
          }
        >
          {TRANSITION_IDS.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      </label>

      <div>
        <p className="mb-2 text-xs text-zinc-500">Effects stack</p>
        <ul className="flex flex-wrap gap-2">
          {EFFECT_IDS.map((id) => {
            const on = effects.includes(id);
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => toggle(id)}
                  className={`rounded-full border px-2.5 py-1 font-mono text-xs transition ${
                    on
                      ? "border-amber-600 bg-amber-950/60 text-amber-200"
                      : "border-zinc-600 text-zinc-400 hover:border-zinc-500"
                  }`}
                >
                  {id}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {effectOnly && effects.length === 0 && (
        <p className="text-xs text-amber-200/80">
          Pick at least one effect (e.g. film_scratches + film_grain on black).
        </p>
      )}
    </div>
  );
}
