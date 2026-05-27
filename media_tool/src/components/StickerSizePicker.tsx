"use client";

import {
  STICKER_OVERLAY_SIZES,
  STICKER_SIZE_LABELS,
  type StickerOverlaySize,
} from "@/lib/sticker-overlay-size";

export function StickerSizePicker({
  value,
  onChange,
  disabled,
}: {
  value: StickerOverlaySize;
  onChange: (size: StickerOverlaySize) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-1.5"
      role="group"
      aria-label="Sticker size"
    >
      <span className="text-[10px] uppercase tracking-wide text-zinc-500">
        Size
      </span>
      {STICKER_OVERLAY_SIZES.map((size) => (
        <button
          key={size}
          type="button"
          disabled={disabled}
          onClick={() => onChange(size)}
          className={`rounded border px-2 py-0.5 text-[10px] transition disabled:opacity-40 ${
            value === size
              ? "border-amber-600/80 bg-amber-950/60 text-amber-200"
              : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
          }`}
          title={STICKER_SIZE_LABELS[size]}
        >
          {size}
        </button>
      ))}
    </div>
  );
}
