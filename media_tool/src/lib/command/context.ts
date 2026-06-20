import type { EpisodeInfo } from "@/lib/episodes";
import type { RenderJob } from "@/lib/render-launcher";
import type {
  ItemAcquisition,
  MediaAcquisitionDocument,
  MediaToolItem,
  MediaToolManifest,
} from "@/lib/types";
import type { MediaLibraryStatus } from "@/lib/types";
import type { GallerySize } from "./gallery-size";
import type { GalleryState, PlayRequest, ResponseLine } from "./types";

export interface LoadState {
  manifest: MediaToolManifest;
  acquisition: MediaAcquisitionDocument;
  manifestPath: string;
  acquisitionPath: string;
  mediaLibrary: MediaLibraryStatus | null;
}

/** Snapshot passed into directive handlers each submit. */
export interface CommandState {
  loadState: LoadState | null;
  items: MediaToolItem[];
  itemIndex: number;
  currentItem: MediaToolItem | undefined;
  currentAcq: ItemAcquisition | undefined;
  isDirty: boolean;
  episodes: EpisodeInfo[];
  gallery: GalleryState | null;
  gallerySize: GallerySize;
  renderJob: RenderJob | null;
}

/** Mutable UI + IO callbacks handlers may invoke. */
export interface CommandActions {
  pushLine: (text: string, tone?: ResponseLine["tone"]) => void;
  clearLines: () => void;
  setGallery: (gallery: GalleryState | null) => void;
  setGallerySize: (size: GallerySize) => void;
  setBusy: (busy: boolean) => void;
  setSaving: (saving: boolean) => void;
  setLoadState: (
    updater: (prev: LoadState | null) => LoadState | null,
  ) => void;
  setSavedItems: (items: Record<string, ItemAcquisition>) => void;
  setRenderJob: (job: RenderJob | null) => void;
  setPlayRequest: (request: PlayRequest | null) => void;
  navigateToIndex: (index: number) => void;
  loadManifest: (path: string, targetItemId?: string) => Promise<void>;
  refreshAfterAcquiredChange: () => Promise<void>;
  bumpPlaySeq: () => number;
}

export interface CommandContext {
  state: CommandState;
  actions: CommandActions;
}

export function requireCueContext(ctx: CommandContext): {
  loadState: LoadState;
  currentItem: MediaToolItem;
  currentAcq: ItemAcquisition;
} | null {
  const { loadState, currentItem, currentAcq } = ctx.state;
  if (!loadState || !currentItem || !currentAcq) {
    ctx.actions.pushLine("Manifest not loaded.", "error");
    return null;
  }
  return { loadState, currentItem, currentAcq };
}
