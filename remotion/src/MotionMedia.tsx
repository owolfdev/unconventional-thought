import {
  AbsoluteFill,
  Img,
  interpolate,
  OffthreadVideo,
  staticFile,
  useVideoConfig,
} from "remotion";
import type { AcquisitionNoteHints } from "./acquisition-notes";
import { noteMediaFilter } from "./acquisition-notes";
import { isGifSrc } from "./is-gif-src";
import {
  getMediaLayoutScale,
  getMotionStyle,
} from "./motion-effects";
import { SyncedGif } from "./SyncedGif";

/** Frame mask only — motion and fit apply on the media element inside. */
const viewportClip: React.CSSProperties = {
  overflow: "hidden",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

type Props = {
  src: string;
  kind: "image" | "video";
  visualMode: string;
  effects: string[];
  hints: AcquisitionNoteHints;
  frame: number;
  durationInFrames: number;
  mediaDelayFrames: number;
  mediaScale?: number;
  mediaFit?: "cover" | "contain" | "fill-height" | "fill-width";
  motionTiltDeg?: number;
  motionScrollSpeed?: number;
};

/**
 * Shared parenting for every still / video cue (same as m022):
 * viewport clips → flex center → transform on Img/Video (not a pre-cropped parent).
 */
export const MotionMedia: React.FC<Props> = ({
  src,
  kind,
  visualMode,
  effects,
  hints,
  frame,
  durationInFrames,
  mediaDelayFrames,
  mediaScale = 1,
  mediaFit,
  motionTiltDeg,
  motionScrollSpeed,
}) => {
  const { width: compW, height: compH } = useVideoConfig();
  const motionFrames = Math.max(1, durationInFrames - mediaDelayFrames);
  const motionFrame = Math.max(0, frame - mediaDelayFrames);

  const fx = getMotionStyle(effects, motionFrame, motionFrames, hints, {
    tiltDeg: motionTiltDeg,
    scrollSpeed: motionScrollSpeed,
  });
  const noteFilter = noteMediaFilter(hints);
  const combinedFilter = [fx.filter, noteFilter].filter(Boolean).join(" ") || undefined;

  const mediaOpacity =
    mediaDelayFrames <= 0
      ? 1
      : interpolate(frame, [mediaDelayFrames - 1, mediaDelayFrames, mediaDelayFrames + 10], [0, 0, 1], {
          extrapolateRight: "clamp",
          extrapolateLeft: "clamp",
        });

  const layout = getMediaLayoutScale(effects, hints, visualMode, mediaFit);
  const sizeScale = Math.max(0.2, Math.min(mediaScale, 4));

  const mediaStyle: React.CSSProperties =
    layout.fit === "fill-height"
      ? {
          height: `${layout.heightPercent * sizeScale}%`,
          width: "auto",
          maxWidth: "none",
          maxHeight: "none",
          objectFit: "contain",
          transform: fx.transform,
          transformOrigin: "center center",
          filter: combinedFilter,
          opacity: mediaOpacity,
        }
      : layout.fit === "fill-width"
        ? {
            width: `${layout.widthPercent * sizeScale}%`,
            height: "auto",
            maxWidth: "none",
            maxHeight: "none",
            objectFit: "contain",
            transform: fx.transform,
            transformOrigin: "center center",
            filter: combinedFilter,
            opacity: mediaOpacity,
          }
        : {
          width: `${layout.widthPercent * sizeScale}%`,
          height: `${layout.heightPercent * sizeScale}%`,
          maxWidth: "100%",
          maxHeight: "100%",
          objectFit: layout.fit,
          transform: fx.transform,
          transformOrigin: "center center",
          filter: combinedFilter,
          opacity: mediaOpacity,
        };

  const mediaSrc = staticFile(src);
  const gifFit =
    layout.fit === "cover"
      ? "cover"
      : layout.fit === "fill" || layout.fit === "fill-height" || layout.fit === "fill-width"
        ? "contain"
        : "contain";
  const gifW =
    layout.fit === "fill-height"
      ? compW
      : Math.round((compW * layout.widthPercent * sizeScale) / 100);
  const gifH =
    layout.fit === "fill-width"
      ? compH
      : Math.round((compH * layout.heightPercent * sizeScale) / 100);
  const gifStyle: React.CSSProperties = {
    transform: fx.transform,
    transformOrigin: "center center",
    filter: combinedFilter,
    opacity: mediaOpacity,
  };

  return (
    <AbsoluteFill style={viewportClip}>
      {kind === "image" && isGifSrc(src) ? (
        <SyncedGif
          src={src}
          width={gifW}
          height={gifH}
          fit={gifFit}
          style={gifStyle}
        />
      ) : kind === "image" ? (
        <Img src={mediaSrc} style={mediaStyle} />
      ) : (
        <OffthreadVideo src={mediaSrc} style={mediaStyle} muted volume={0} />
      )}
    </AbsoluteFill>
  );
};
