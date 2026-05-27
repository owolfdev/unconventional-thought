"use client";

import {
  BACKGROUND_COLOR_PRESETS,
  normalizeBackgroundColor,
} from "@/lib/background-color";

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export function BackgroundColorControl({ value, onChange }: Props) {
  const normalized = normalizeBackgroundColor(value);

  return (
    <div className="flex flex-col gap-2 text-sm">
      <span className="text-zinc-500">Background color</span>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="color"
          aria-label="Background color picker"
          className="h-9 w-12 cursor-pointer rounded border border-zinc-700 bg-zinc-950"
          value={normalized}
          onChange={(e) => onChange(e.target.value)}
        />
        <input
          type="text"
          className="w-28 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 font-mono text-xs"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => onChange(normalized)}
          placeholder="#000000"
          spellCheck={false}
        />
        <div
          className="h-9 w-9 shrink-0 rounded border border-zinc-600"
          style={{ backgroundColor: normalized }}
          title={normalized}
        />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {BACKGROUND_COLOR_PRESETS.map((preset) => (
          <button
            key={preset.value}
            type="button"
            onClick={() => onChange(preset.value)}
            className={`rounded border px-2 py-0.5 text-xs ${
              normalized === preset.value
                ? "border-amber-600 bg-amber-950/40 text-amber-200"
                : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}
