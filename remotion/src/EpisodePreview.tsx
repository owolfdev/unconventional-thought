import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { ShotClip } from "./ShotClip";
import {
  showCueOverlay as previewShowCueOverlay,
  showStickerOverlays as previewShowStickerOverlays,
} from "./preview-settings";
import { timeline } from "./timeline-data";

export const EpisodePreview: React.FC = () => {
  const audioSrc = staticFile(timeline.audioSrc);
  const audioFromFrame = timeline.audioFromFrame ?? 0;
  const showCueOverlay =
    timeline.showCueOverlay !== false && previewShowCueOverlay;
  const showStickerOverlays =
    timeline.showStickerOverlays !== false && previewShowStickerOverlays;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {audioFromFrame > 0 ? (
        <Sequence from={audioFromFrame} layout="none">
          <Audio src={audioSrc} />
        </Sequence>
      ) : (
        <Audio src={audioSrc} />
      )}
      {timeline.shots.map((shot) => (
        <Sequence
          key={shot.id}
          from={shot.fromFrame}
          durationInFrames={shot.durationInFrames}
          name={shot.id}
        >
          <ShotClip
            shot={shot}
            showCueOverlay={showCueOverlay}
            showStickerOverlays={showStickerOverlays}
          />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
