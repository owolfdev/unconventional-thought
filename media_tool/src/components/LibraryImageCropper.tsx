"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { mimeForFilename } from "@/lib/media-library/crop-shared";
import type { LibraryAssetMeta } from "@/lib/media-library/types";

export type CropAspect = "free" | "16:9" | "4:3" | "1:1";

interface NormalizedCrop {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Props {
  assetId: string;
  filename: string;
  src: string;
  onApplied: (meta: LibraryAssetMeta) => void;
  onCancel: () => void;
}

const ASPECT_OPTIONS: { id: CropAspect; label: string; ratio: number | null }[] = [
  { id: "free", label: "Free", ratio: null },
  { id: "16:9", label: "16:9", ratio: 16 / 9 },
  { id: "4:3", label: "4:3", ratio: 4 / 3 },
  { id: "1:1", label: "1:1", ratio: 1 },
];

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function fitContain(
  containerW: number,
  containerH: number,
  imageW: number,
  imageH: number,
) {
  const scale = Math.min(containerW / imageW, containerH / imageH);
  const width = imageW * scale;
  const height = imageH * scale;
  return {
    x: (containerW - width) / 2,
    y: (containerH - height) / 2,
    width,
    height,
    scale,
  };
}

function initialCrop(ratio: number | null): NormalizedCrop {
  if (!ratio) {
    return { x: 0.05, y: 0.05, w: 0.9, h: 0.9 };
  }
  const maxW = 0.92;
  let w = maxW;
  let h = w / ratio;
  if (h > 0.92) {
    h = 0.92;
    w = h * ratio;
  }
  return {
    x: (1 - w) / 2,
    y: (1 - h) / 2,
    w,
    h,
  };
}

function applyAspect(crop: NormalizedCrop, ratio: number): NormalizedCrop {
  const cx = crop.x + crop.w / 2;
  const cy = crop.y + crop.h / 2;
  let w = crop.w;
  let h = w / ratio;
  if (h > 1) {
    h = 1;
    w = h * ratio;
  }
  if (w > 1) {
    w = 1;
    h = w / ratio;
  }
  return {
    x: clamp01(cx - w / 2),
    y: clamp01(cy - h / 2),
    w,
    h,
  };
}

function constrainCrop(crop: NormalizedCrop, ratio: number | null): NormalizedCrop {
  const min = 0.04;
  let next = { ...crop };
  next.w = Math.max(min, Math.min(1, next.w));
  next.h = Math.max(min, Math.min(1, next.h));
  next.x = clamp01(next.x);
  next.y = clamp01(next.y);
  if (next.x + next.w > 1) next.x = 1 - next.w;
  if (next.y + next.h > 1) next.y = 1 - next.h;
  if (ratio) next = applyAspect(next, ratio);
  if (next.x + next.w > 1) next.x = 1 - next.w;
  if (next.y + next.h > 1) next.y = 1 - next.h;
  return next;
}

type DragMode =
  | { kind: "move"; startX: number; startY: number; crop: NormalizedCrop }
  | {
      kind: "resize";
      handle: "nw" | "ne" | "sw" | "se";
      startX: number;
      startY: number;
      crop: NormalizedCrop;
    };

export function LibraryImageCropper({
  assetId,
  filename,
  src,
  onApplied,
  onCancel,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<DragMode | null>(null);

  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [layout, setLayout] = useState({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });
  const [aspect, setAspect] = useState<CropAspect>("free");
  const [crop, setCrop] = useState<NormalizedCrop>(() => initialCrop(null));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const aspectRatio =
    ASPECT_OPTIONS.find((o) => o.id === aspect)?.ratio ?? null;

  const measure = useCallback(() => {
    const container = containerRef.current;
    const img = imgRef.current;
    if (!container || !img || !img.naturalWidth) return;
    const rect = container.getBoundingClientRect();
    const fit = fitContain(
      rect.width,
      rect.height,
      img.naturalWidth,
      img.naturalHeight,
    );
    setNatural({ w: img.naturalWidth, h: img.naturalHeight });
    setLayout(fit);
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  useEffect(() => {
    setCrop(initialCrop(aspectRatio));
  }, [aspect, aspectRatio]);

  const cropPx = {
    left: layout.x + crop.x * layout.width,
    top: layout.y + crop.y * layout.height,
    width: crop.w * layout.width,
    height: crop.h * layout.height,
  };

  const pointerToNormalized = (clientX: number, clientY: number) => {
    const container = containerRef.current;
    if (!container || layout.width <= 0) return { nx: 0, ny: 0 };
    const rect = container.getBoundingClientRect();
    const px = clientX - rect.left - layout.x;
    const py = clientY - rect.top - layout.y;
    return {
      nx: clamp01(px / layout.width),
      ny: clamp01(py / layout.height),
    };
  };

  const onPointerDownMove = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = {
      kind: "move",
      startX: e.clientX,
      startY: e.clientY,
      crop: { ...crop },
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerDownResize =
    (handle: "nw" | "ne" | "sw" | "se") => (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragRef.current = {
        kind: "resize",
        handle,
        startX: e.clientX,
        startY: e.clientY,
        crop: { ...crop },
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || layout.width <= 0) return;

    const dx = (e.clientX - drag.startX) / layout.width;
    const dy = (e.clientY - drag.startY) / layout.height;

    if (drag.kind === "move") {
      const next = constrainCrop(
        {
          ...drag.crop,
          x: drag.crop.x + dx,
          y: drag.crop.y + dy,
        },
        aspectRatio,
      );
      setCrop(next);
      return;
    }

    const base = drag.crop;
    let x1 = base.x;
    let y1 = base.y;
    let x2 = base.x + base.w;
    let y2 = base.y + base.h;
    const { nx, ny } = pointerToNormalized(e.clientX, e.clientY);

    if (drag.handle.includes("w")) x1 = nx;
    if (drag.handle.includes("e")) x2 = nx;
    if (drag.handle.includes("n")) y1 = ny;
    if (drag.handle.includes("s")) y2 = ny;

    if (aspectRatio) {
      const w = Math.max(0.04, x2 - x1);
      let h = w / aspectRatio;
      if (drag.handle.includes("n")) {
        y1 = y2 - h;
      } else {
        y2 = y1 + h;
      }
    }

    const next = constrainCrop(
      {
        x: Math.min(x1, x2),
        y: Math.min(y1, y2),
        w: Math.abs(x2 - x1),
        h: Math.abs(y2 - y1),
      },
      aspectRatio,
    );
    setCrop(next);
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  const applyCrop = async () => {
    const img = imgRef.current;
    if (!img || !natural.w || !natural.h) return;

    setBusy(true);
    setError(null);
    try {
      const sx = Math.round(crop.x * natural.w);
      const sy = Math.round(crop.y * natural.h);
      const sw = Math.max(1, Math.round(crop.w * natural.w));
      const sh = Math.max(1, Math.round(crop.h * natural.h));

      const canvas = document.createElement("canvas");
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable");

      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

      const mime = mimeForFilename(filename);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("Export failed"))),
          mime,
          mime === "image/jpeg" ? 0.92 : undefined,
        );
      });

      const formData = new FormData();
      formData.append("file", blob, filename);

      const res = await fetch(
        `/api/library/asset/${encodeURIComponent(assetId)}/crop`,
        { method: "POST", body: formData },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Crop save failed");
      onApplied(data.meta as LibraryAssetMeta);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Crop failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
      role="dialog"
      aria-modal
      aria-label="Crop image"
    >
      <div className="flex max-h-[95vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Crop image</h2>
            <p className="text-xs text-zinc-500">{filename}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-sm text-zinc-400 hover:text-white"
          >
            Cancel
          </button>
        </div>

        <div
          ref={containerRef}
          className="relative min-h-[280px] flex-1 bg-black"
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={src}
            alt={filename}
            className="absolute inset-0 h-full w-full object-contain"
            draggable={false}
            onLoad={measure}
          />

          {layout.width > 0 && (
            <>
              <div
                className="pointer-events-none absolute bg-black/55"
                style={{
                  left: layout.x,
                  top: layout.y,
                  width: layout.width,
                  height: cropPx.top - layout.y,
                }}
              />
              <div
                className="pointer-events-none absolute bg-black/55"
                style={{
                  left: layout.x,
                  top: cropPx.top + cropPx.height,
                  width: layout.width,
                  height: layout.y + layout.height - (cropPx.top + cropPx.height),
                }}
              />
              <div
                className="pointer-events-none absolute bg-black/55"
                style={{
                  left: layout.x,
                  top: cropPx.top,
                  width: cropPx.left - layout.x,
                  height: cropPx.height,
                }}
              />
              <div
                className="pointer-events-none absolute bg-black/55"
                style={{
                  left: cropPx.left + cropPx.width,
                  top: cropPx.top,
                  width: layout.x + layout.width - (cropPx.left + cropPx.width),
                  height: cropPx.height,
                }}
              />

              <div
                className="absolute cursor-move border-2 border-amber-400 shadow-[0_0_0_1px_rgba(0,0,0,0.5)_inset]"
                style={{
                  left: cropPx.left,
                  top: cropPx.top,
                  width: cropPx.width,
                  height: cropPx.height,
                }}
                onPointerDown={onPointerDownMove}
              >
                {(["nw", "ne", "sw", "se"] as const).map((handle) => (
                  <span
                    key={handle}
                    className={`absolute h-3 w-3 rounded-full border-2 border-amber-400 bg-zinc-950 ${
                      handle === "nw"
                        ? "-left-1.5 -top-1.5 cursor-nwse-resize"
                        : handle === "ne"
                          ? "-right-1.5 -top-1.5 cursor-nesw-resize"
                          : handle === "sw"
                            ? "-bottom-1.5 -left-1.5 cursor-nesw-resize"
                            : "-bottom-1.5 -right-1.5 cursor-nwse-resize"
                    }`}
                    onPointerDown={onPointerDownResize(handle)}
                  />
                ))}
                <div className="pointer-events-none absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] text-amber-200">
                  {Math.round(crop.w * natural.w)}×{Math.round(crop.h * natural.h)}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="space-y-3 border-t border-zinc-800 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-zinc-500">Aspect</span>
            {ASPECT_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setAspect(opt.id)}
                className={`rounded-lg px-3 py-1 text-xs font-medium ${
                  aspect === opt.id
                    ? "bg-amber-700 text-white"
                    : "border border-zinc-700 text-zinc-300 hover:bg-zinc-900"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-zinc-600">
            Drag the box to move · corner handles to resize · overwrites the library
            file in place
          </p>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void applyCrop()}
              className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
            >
              {busy ? "Saving…" : "Apply crop"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onCancel}
              className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-900 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
