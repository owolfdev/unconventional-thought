import { AbsoluteFill, Audio, staticFile } from "remotion";
import { z } from "zod";
import { ShotClip } from "./ShotClip";
import { showCueOverlay as previewShowCueOverlay } from "./preview-settings";
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

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <Audio src={staticFile(timeline.audioSrc)} startFrom={shot.fromFrame} />
      <ShotClip shot={shot} showCueOverlay={showCueOverlay} />
    </AbsoluteFill>
  );
};
