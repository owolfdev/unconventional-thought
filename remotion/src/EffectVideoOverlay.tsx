import {
  AbsoluteFill,
  OffthreadVideo,
  Sequence,
  staticFile,
  useVideoConfig,
} from "remotion";
import type { VideoOverlay } from "./types";

type Props = {
  overlay: VideoOverlay;
  shotDurationInFrames: number;
};

/** Full-shot overlay: random trim + additive blend. */
export const EffectVideoOverlay: React.FC<Props> = ({
  overlay,
  shotDurationInFrames,
}) => {
  const { fps } = useVideoConfig();
  const trimBefore = Math.round(overlay.startFromSec * fps);
  const playFrames = Math.max(1, shotDurationInFrames);
  // trimAfter required — without it Remotion freezes on one scratch frame (loop=true omitted it).
  const trimAfter = trimBefore + playFrames;

  return (
    <AbsoluteFill
      style={{
        mixBlendMode: overlay.blendMode ?? "plus-lighter",
        opacity: overlay.opacity ?? 0.75,
        pointerEvents: "none",
      }}
    >
      <OffthreadVideo
        src={staticFile(overlay.src)}
        trimBefore={trimBefore}
        trimAfter={trimAfter}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
        muted
        volume={0}
        pauseWhenBuffering={false}
      />
    </AbsoluteFill>
  );
};

/** Renders in/out transition windows as nested sequences. */
export const ShotEffectOverlays: React.FC<Props> = ({
  overlay,
  shotDurationInFrames,
}) => {
  const { fps } = useVideoConfig();
  const placement = overlay.placement ?? "full";
  const windowSec = overlay.windowSec ?? 1.2;
  const windowFrames = Math.max(
    1,
    Math.min(Math.round(windowSec * fps), shotDurationInFrames),
  );

  if (placement === "full") {
    return (
      <EffectVideoOverlay
        overlay={overlay}
        shotDurationInFrames={shotDurationInFrames}
      />
    );
  }

  const from =
    placement === "out"
      ? Math.max(0, shotDurationInFrames - windowFrames)
      : 0;

  return (
    <Sequence from={from} durationInFrames={windowFrames} layout="none">
      <EffectVideoOverlay
        overlay={{ ...overlay, placement: "full", loop: false }}
        shotDurationInFrames={windowFrames}
      />
    </Sequence>
  );
};
