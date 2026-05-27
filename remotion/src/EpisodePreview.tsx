import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { ShotClip } from "./ShotClip";
import { showCueOverlay as previewShowCueOverlay } from "./preview-settings";
import { timeline } from "./timeline-data";

export const EpisodePreview: React.FC = () => {
  const audioSrc = staticFile(timeline.audioSrc);
  const showCueOverlay =
    timeline.showCueOverlay !== false && previewShowCueOverlay;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <Audio src={audioSrc} />
      {timeline.shots.map((shot) => (
        <Sequence
          key={shot.id}
          from={shot.fromFrame}
          durationInFrames={shot.durationInFrames}
          name={shot.id}
        >
          <ShotClip shot={shot} showCueOverlay={showCueOverlay} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
