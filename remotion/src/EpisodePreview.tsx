import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { ShotClip } from "./ShotClip";
import {
  showCueOverlay as previewShowCueOverlay,
  showStickerOverlays as previewShowStickerOverlays,
} from "./preview-settings";
import { timeline } from "./timeline-data";

export const EpisodePreview: React.FC = () => {
  const audioFromFrame = timeline.audioFromFrame ?? 0;
  const showCueOverlay =
    timeline.showCueOverlay !== false && previewShowCueOverlay;
  const showStickerOverlays =
    timeline.showStickerOverlays !== false && previewShowStickerOverlays;

  const audio =
    timeline.audioSrc != null && timeline.audioSrc !== "" ? (
      audioFromFrame > 0 ? (
        <Sequence from={audioFromFrame} layout="none">
          <Audio src={staticFile(timeline.audioSrc)} />
        </Sequence>
      ) : (
        <Audio src={staticFile(timeline.audioSrc)} />
      )
    ) : null;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {audio}
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
