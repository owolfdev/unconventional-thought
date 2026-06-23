import { cloneSavedItems } from "@/lib/acquisition-dirty";
import type { ItemAcquisition, MediaAcquisitionDocument } from "@/lib/types";
import { requireCueContext, type CommandContext } from "./context";

async function persistAcquisitionDocument(
  ctx: CommandContext,
  acquisition: MediaAcquisitionDocument,
): Promise<
  | { ok: true; acquisition: MediaAcquisitionDocument; path: string }
  | { ok: false; error: string }
> {
  const cue = requireCueContext(ctx);
  if (!cue) return { ok: false, error: "Manifest not loaded." };

  ctx.actions.setSaving(true);
  try {
    const res = await fetch("/api/acquisition", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        manifestPath: cue.loadState.manifestPath,
        acquisition,
      }),
    });
    const data = (await res.json()) as {
      error?: string;
      acquisition?: MediaAcquisitionDocument;
      path?: string;
    };
    if (!res.ok) {
      return { ok: false, error: data.error ?? "Save failed" };
    }
    if (!data.acquisition) {
      return { ok: false, error: "Save failed" };
    }
    ctx.actions.setLoadState((s) =>
      s ? { ...s, acquisition: data.acquisition! } : s,
    );
    ctx.actions.setSavedItems(cloneSavedItems(data.acquisition!.items));
    return {
      ok: true,
      acquisition: data.acquisition,
      path: data.path ?? cue.loadState.acquisitionPath,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Save failed",
    };
  } finally {
    ctx.actions.setSaving(false);
  }
}

export async function persistAcquisitionItem(
  ctx: CommandContext,
  itemId: string,
  updated: ItemAcquisition,
): Promise<
  | { ok: true; acquisition: MediaAcquisitionDocument; path: string }
  | { ok: false; error: string }
> {
  const cue = requireCueContext(ctx);
  if (!cue) return { ok: false, error: "Manifest not loaded." };

  return persistAcquisitionDocument(ctx, {
    ...cue.loadState.acquisition,
    items: {
      ...cue.loadState.acquisition.items,
      [itemId]: updated,
    },
  });
}

export async function persistAcquisitionItems(
  ctx: CommandContext,
  updates: Record<string, ItemAcquisition>,
): Promise<
  | { ok: true; acquisition: MediaAcquisitionDocument; path: string }
  | { ok: false; error: string }
> {
  const cue = requireCueContext(ctx);
  if (!cue) return { ok: false, error: "Manifest not loaded." };

  return persistAcquisitionDocument(ctx, {
    ...cue.loadState.acquisition,
    items: {
      ...cue.loadState.acquisition.items,
      ...updates,
    },
  });
}
