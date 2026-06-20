import { helpText, parseDirectiveInput } from "./directives";
import type { CommandContext } from "./context";
import type { ParsedDirective } from "./types";
import {
  goToAdjacentCue,
  handleAdd,
  handleComplete,
  handleEffect,
  handleEpisodes,
  handleGallerySize,
  handleHelpTopic,
  handleMode,
  handleNavigate,
  handlePhase5Stub,
  handlePlay,
  handlePreviewGallery,
  handleReadOnlyCue,
  handleRender,
  handleSave,
  handleSearch,
  switchEpisode,
} from "./handlers";

export { parseDirectiveInput };

/**
 * Run a parsed directive against workspace context.
 * Parser lives in directives.ts; handlers in handlers.ts.
 */
export async function executeDirective(
  parsed: ParsedDirective,
  ctx: CommandContext,
): Promise<void> {
  switch (parsed.kind) {
    case "unknown":
      if (parsed.raw.startsWith("@")) {
        ctx.actions.pushLine(
          parsed.raw || "Unknown directive",
          "error",
        );
      } else if (parsed.raw) {
        ctx.actions.pushLine(
          "Natural language agent coming in phase 4. Try @help or @search library …",
          "warn",
        );
      }
      return;

    case "clear":
      ctx.actions.clearLines();
      return;

    case "help":
      ctx.actions.pushLine(helpText());
      return;

    case "helpTopic":
      handleHelpTopic(ctx, parsed.topic);
      return;

    case "episodes":
      handleEpisodes(ctx);
      return;

    case "episode":
      switchEpisode(ctx, parsed.ref);
      return;

    case "info":
    case "layers":
    case "effects":
    case "status":
      handleReadOnlyCue(ctx, parsed);
      return;

    case "effect":
      await handleEffect(ctx, parsed.action, parsed.id);
      return;

    case "mode":
      await handleMode(ctx, parsed.set);
      return;

    case "render":
      await handleRender(ctx, parsed.args);
      return;

    case "play":
      handlePlay(ctx, parsed.loopCount);
      return;

    case "navigate":
      handleNavigate(ctx, parsed);
      return;

    case "search":
      await handleSearch(ctx, parsed.engine, parsed.query);
      return;

    case "add":
      await handleAdd(ctx, parsed.index);
      return;

    case "preview":
      handlePreviewGallery(ctx, parsed.index);
      return;

    case "gallery":
      handleGallerySize(ctx, parsed.size);
      return;

    case "save":
      await handleSave(ctx);
      return;

    case "complete":
      await handleComplete(ctx);
      return;

    case "split":
    case "merge":
    case "use":
    case "confirm":
    case "cancel":
      handlePhase5Stub(ctx, parsed);
      return;

    default: {
      const _exhaustive: never = parsed;
      void _exhaustive;
    }
  }
}

/** Parse prompt text and execute. Used by CommandWorkspace submit handler. */
export async function executePrompt(
  raw: string,
  ctx: CommandContext,
): Promise<void> {
  const trimmed = raw.trim();
  if (!trimmed) return;
  await executeDirective(parseDirectiveInput(trimmed), ctx);
}

export { goToAdjacentCue };
