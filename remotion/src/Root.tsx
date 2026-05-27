import { Composition } from "remotion";
import { CuePreview, cuePreviewSchema } from "./CuePreview";
import { EpisodePreview } from "./EpisodePreview";
import { timeline } from "./timeline-data";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="EpisodePreview"
        component={EpisodePreview}
        durationInFrames={timeline.durationInFrames}
        fps={timeline.fps}
        width={timeline.width}
        height={timeline.height}
      />
      <Composition
        id="CuePreview"
        component={CuePreview}
        durationInFrames={timeline.shots[0]?.durationInFrames ?? 30}
        fps={timeline.fps}
        width={timeline.width}
        height={timeline.height}
        defaultProps={{ shotId: timeline.shots[0]?.id ?? "m001" }}
        schema={cuePreviewSchema}
        calculateMetadata={({ props }) => {
          const shot = timeline.shots.find((s) => s.id === props.shotId);
          if (!shot) {
            throw new Error(`Unknown cue: ${props.shotId}`);
          }
          return {
            durationInFrames: shot.durationInFrames,
            fps: timeline.fps,
            width: timeline.width,
            height: timeline.height,
          };
        }}
      />
    </>
  );
};
