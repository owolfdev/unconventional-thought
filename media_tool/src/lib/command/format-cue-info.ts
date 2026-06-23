import type {
  ItemAcquisition,
  MediaToolItem,
  SelectedMedia,
} from "@/lib/types";
import { formatCueLabel, formatCuePositionLabel } from "@/lib/cue-id";
import { VISUAL_MODE_LABELS, normalizeVisualMode } from "@/lib/visual-modes";
import {
  getActiveStickerSelection,
  selectionFilename,
} from "@/lib/overlay-media";
import { formatVideoTime, mediaKindFromUrl } from "@/lib/selection-media";

function plateLines(acq: ItemAcquisition): string[] {
  const lines: string[] = [];
  let n = 1;
  for (const q of acq.queries) {
    for (const s of q.selections) {
      lines.push(formatSelection(n, s));
      n += 1;
    }
  }
  if (lines.length === 0) lines.push("(no plates selected)");
  return lines;
}

function formatSelection(index: number, s: SelectedMedia): string {
  const fn = s.url.split("/").pop()?.split("?")[0] ?? s.title;
  const inPoint =
    s.start_from_sec != null && mediaKindFromUrl(s.url) === "video"
      ? ` · in @ ${formatVideoTime(s.start_from_sec)}`
      : "";
  return `[${index}] ${fn} · ${s.engine_id} · ${s.title.slice(0, 60)}${inPoint}`;
}

export function formatInfo(
  item: MediaToolItem,
  acq: ItemAcquisition,
  episode: string,
  dirty: boolean,
): string {
  const people =
    item.people.length > 0
      ? item.people.map((p) => p.name).join(", ")
      : "—";
  return [
    `${formatCueLabel(item.id)} · cue ${item.cue} · ${episode}`,
    `${item.t_start.toFixed(2)}s – ${item.t_end.toFixed(2)}s · ${item.duration_sec}s`,
    `spoken: "${item.spoken}"`,
    `editorial: ${item.editorial_intent}`,
    `situation: ${item.situation || "—"}`,
    `dates: ${item.date_from || "—"} → ${item.date_to || "—"}`,
    `people: ${people}`,
    item.avoid.length ? `avoid: ${item.avoid.join(" · ")}` : null,
    item.artifact
      ? `artifact: ${item.artifact.object} — ${item.artifact.story_link}`
      : null,
    `status: ${acq.status}${dirty ? " · unsaved" : ""}`,
    `visual: ${VISUAL_MODE_LABELS[normalizeVisualMode(acq.resolved_visual_mode)]}`,
    acq.notes ? `notes: ${acq.notes}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatLayers(acq: ItemAcquisition): string {
  const lines = [...plateLines(acq)];
  const sticker = getActiveStickerSelection(acq);
  if (sticker) {
    lines.push(
      `sticker: ${selectionFilename(sticker) ?? sticker.title} · overlay ${acq.sticker_overlay_enabled !== false ? "on" : "off"} · ${acq.sticker_overlay_position ?? "center"}`,
    );
  }
  if (acq.title_overlay_enabled) {
    lines.push("title overlay: on");
  }
  if (acq.text_graphic_layer) {
    lines.push(`text graphic layer: "${acq.text_graphic_layer.text ?? ""}"`);
  }
  return lines.join("\n");
}

export function formatEffects(acq: ItemAcquisition): string {
  const fx =
    acq.effects.length > 0 ? acq.effects.join(" · ") : "(none)";
  const tr = acq.transition ?? "none";
  return `effects: ${fx}\ntransition: ${tr}`;
}

export function formatStatus(
  item: MediaToolItem,
  acq: ItemAcquisition,
  total: number,
  dirty: boolean,
): string {
  const mode = normalizeVisualMode(acq.resolved_visual_mode);
  return [
    `${formatCueLabel(item.id)} · ${formatCuePositionLabel(item, total)}`,
    `mode: ${VISUAL_MODE_LABELS[mode]} · ${mode}`,
    `status: ${acq.status}`,
    `media type: ${acq.resolved_media_type}`,
    dirty ? "unsaved changes" : "saved",
  ].join("\n");
}
