import {
  formatVideoTime,
  mediaKindFromUrl,
  normalizeStartFromSec,
  parseInpointArg,
  resolveSelectionPreviewUrl,
  updateSelectionStartFromSec,
} from "@/lib/selection-media";
import type { SelectedMedia } from "@/lib/types";
import type { CommandContext } from "./context";
import { requireCueContext } from "./context";

export function handleInpoint(ctx: CommandContext, arg?: string): void {
  const cue = requireCueContext(ctx);
  if (!cue) return;

  const mediaLibrary = cue.loadState.mediaLibrary;
  if (!mediaLibrary) {
    ctx.actions.pushLine("Media library not loaded.", "error");
    return;
  }

  const activePlate = ctx.actions.getActivePlate();
  if (!activePlate) {
    ctx.actions.pushLine("No plate media on this cue.", "error");
    return;
  }

  const src = resolveSelectionPreviewUrl(
    activePlate,
    mediaLibrary.project,
    cue.currentItem.id,
  );
  if (mediaKindFromUrl(src) !== "video") {
    ctx.actions.pushLine(
      "Active plate is not a video — @inpoint applies to video plates only.",
      "warn",
    );
    return;
  }

  const trimmed = arg?.trim();
  if (!trimmed) {
    const sec = activePlate.start_from_sec;
    ctx.actions.pushLine(
      sec != null
        ? `Video in point: ${formatVideoTime(sec)} · ${activePlate.title}`
        : `Video in point: 0:00.0 (start) · ${activePlate.title}`,
    );
    return;
  }

  const parsed = parseInpointArg(trimmed);
  if (parsed === null) {
    ctx.actions.pushLine(
      "Usage: @inpoint 45 · @inpoint 1:23.4 · @inpoint playhead · @inpoint clear",
      "error",
    );
    return;
  }

  if (parsed === "clear") {
    applyInpoint(ctx, activePlate, undefined);
    ctx.actions.pushLine(
      `Cleared in point on ${activePlate.title}. @save to persist.`,
      "success",
    );
    return;
  }

  if (parsed === "playhead") {
    const t = ctx.actions.getActivePlateVideoTime();
    if (t == null || !Number.isFinite(t)) {
      ctx.actions.pushLine(
        "Scrub the cue preview video (native controls), then @inpoint playhead.",
        "warn",
      );
      return;
    }
    const sec = normalizeStartFromSec(t);
    if (sec == null) {
      ctx.actions.pushLine("Playhead time is invalid.", "error");
      return;
    }
    applyInpoint(ctx, activePlate, sec);
    ctx.actions.pushLine(
      `Video in point → ${formatVideoTime(sec)} (from playhead). @save to persist.`,
      "success",
    );
    return;
  }

  applyInpoint(ctx, activePlate, parsed);
  ctx.actions.pushLine(
    `Video in point → ${formatVideoTime(parsed)}. @save to persist.`,
    "success",
  );
}

function applyInpoint(
  ctx: CommandContext,
  selection: SelectedMedia,
  startFromSec: number | undefined,
): void {
  ctx.actions.updateCurrentAcq((acq) =>
    updateSelectionStartFromSec(acq, selection.result_id, startFromSec),
  );
}
