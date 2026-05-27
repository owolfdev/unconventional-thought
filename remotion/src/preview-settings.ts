import settingsJson from "./preview-settings.json";

export interface PreviewSettings {
  version: number;
  showCueOverlay: boolean;
  updated_at?: string;
}

export const previewSettings = settingsJson as PreviewSettings;

export const showCueOverlay = previewSettings.showCueOverlay !== false;
