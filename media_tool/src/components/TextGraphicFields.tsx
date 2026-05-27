"use client";

import type { TextGraphic } from "@/lib/types";

interface Props {
  value: TextGraphic;
  defaultText: string;
  onChange: (value: TextGraphic) => void;
  /** Shorter labels when nested under “layer” UI */
  compact?: boolean;
}

export function TextGraphicFields({
  value,
  defaultText,
  onChange,
  compact = false,
}: Props) {
  const labelClass = compact
    ? "text-violet-300/80"
    : "text-violet-300/80";

  return (
    <div className="grid gap-2 sm:grid-cols-3">
      <label>
        <span className={labelClass}>type</span>
        <input
          className="mt-1 w-full rounded border border-violet-800 bg-zinc-950 px-2 py-1"
          value={value.type}
          onChange={(e) => onChange({ ...value, type: e.target.value })}
          placeholder="transcription"
        />
      </label>
      <label className="sm:col-span-2">
        <span className={labelClass}>text</span>
        <input
          className="mt-1 w-full rounded border border-violet-800 bg-zinc-950 px-2 py-1"
          value={value.text || defaultText}
          onChange={(e) => onChange({ ...value, text: e.target.value })}
        />
      </label>
      <label>
        <span className={labelClass}>style</span>
        <input
          className="mt-1 w-full rounded border border-violet-800 bg-zinc-950 px-2 py-1"
          value={value.style}
          onChange={(e) => onChange({ ...value, style: e.target.value })}
          placeholder="typewriter"
        />
      </label>
    </div>
  );
}


function defaultTextGraphic(spoken: string): TextGraphic {
  return {
    type: "transcription",
    text: spoken,
    style: "typewriter",
  };
}

export { defaultTextGraphic };
