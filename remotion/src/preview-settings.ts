import settingsJson from "./preview-settings.json";

export interface PreviewSettings {
  version: number;
  showCueOverlay: boolean;
  showStickerOverlays?: boolean;
  updated_at?: string;
}

export const previewSettings = settingsJson as PreviewSettings;

export const showCueOverlay = previewSettings.showCueOverlay !== false;
export const showStickerOverlays = previewSettings.showStickerOverlays !== false;
