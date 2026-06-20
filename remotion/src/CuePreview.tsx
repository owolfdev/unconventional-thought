import { AbsoluteFill, Audio, staticFile } from "remotion";
import { z } from "zod";
import { ShotClip } from "./ShotClip";
import {
  showCueOverlay as previewShowCueOverlay,
  showStickerOverlays as previewShowStickerOverlays,
} from "./preview-settings";
import { timeline } from "./timeline-data";

export const cuePreviewSchema = z.object({
  shotId: z.string(),
});

export type CuePreviewProps = z.infer<typeof cuePreviewSchema>;

export const CuePreview: React.FC<CuePreviewProps> = ({ shotId }) => {
  const shot = timeline.shots.find((s) => s.id === shotId);
  if (!shot) {
    throw new Error(
      `Cue "${shotId}" not in timeline. Run npm run build:timeline after saving acquisitions.`,
    );
  }

  const showCueOverlay =
    timeline.showCueOverlay !== false && previewShowCueOverlay;
  const showStickerOverlays =
    timeline.showStickerOverlays !== false && previewShowStickerOverlays;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {timeline.audioSrc ? (
        <Audio
          src={staticFile(timeline.audioSrc)}
          startFrom={Math.round(shot.tStart * timeline.fps)}
        />
      ) : null}
      <ShotClip
        shot={shot}
        showCueOverlay={showCueOverlay}
        showStickerOverlays={showStickerOverlays}
      />
    </AbsoluteFill>
  );
};
