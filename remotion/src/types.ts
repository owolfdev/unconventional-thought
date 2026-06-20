export interface TextGraphicSpec {
  type: string;
  text: string;
  style: string;
  optional_texture?: string;
}

/** Stock effect clip from `media/_effects` (built by build_remotion_timeline.py). */
/** One plate image/video in a multi-selection sequence. */
export interface PlateFrame {
  src: string;
  mediaKind: "image" | "video";
  /** Seconds into source video where playback begins. */
  startFromSec?: number;
}

export interface VideoOverlay {
  src: string;
  /** Seconds into source file (after skipping head/tail). */
  startFromSec: number;
  blendMode?: "plus-lighter" | "screen";
  opacity?: number;
  /** full = entire shot; in/out = transition window at start/end. */
  placement?: "full" | "in" | "out";
  /** Duration of in/out window in seconds. */
  windowSec?: number;
  loop?: boolean;
}

export interface Shot {
  id: string;
  cue: number;
  fromFrame: number;
  durationInFrames: number;
  tStart: number;
  tEnd: number;
  spoken: string;
  /** media_tool acquisition notes — editorial / render hints. */
  notes: string | null;
  visualMode: string;
  mediaType: string;
  backgroundColor: string;
  /** Frames before photo/video appears (previous cue bleeds through). */
  mediaDelayFrames?: number;
  /** Multiplier for layout size (e.g. 0.75 = 25% smaller in frame). */
  mediaScale?: number;
  /** Force cover or contain (overrides effect-based fit). */
  mediaFit?: "cover" | "contain" | "fill-height" | "fill-width";
  /** Override tilt_left / tilt_right degrees (e.g. -5.5). */
  motionTiltDeg?: number;
  /** Scroll travel multiplier vs default ±10% (e.g. 0.5 = slower / gentler). */
  motionScrollSpeed?: number;
  effects: string[];
  transition: string | null;
  textGraphic: TextGraphicSpec | null;
  textGraphicLayer: TextGraphicSpec | null;
  /** Comma-phrase reveal frames (offsets from shot start), from Whisper transcript. */
  textBlockStartFrames?: number[];
  /** Typewriter reveal speed (>1 = faster). */
  textRevealSpeedMult?: number;
  src: string | null;
  /** Video in-point when using single src (no plateSequence). */
  startFromSec?: number;
  /** Multiple plate stills/videos shown in equal time slices across the cue. */
  plateSequence?: PlateFrame[];
  /** Transparent PNG sticker (OpenAI / sticker-*.png) or GIPHY GIF. */
  stickerSrc?: string | null;
  /** Max width/height vs frame (percent). From acquisition sticker_overlay_size. */
  stickerMaxPercent?: number;
  /** Hide sticker/GIF after this many seconds from cue start (e.g. 1). */
  stickerHideAfterSec?: number;
  /** Shake / tremble on sticker only (not the plate). */
  stickerEffects?: string[];
  /** Transparent PNG title artwork (OpenAI / title-*.png). */
  titleOverlaySrc?: string | null;
  mediaKind: "image" | "video" | "none" | "generated" | "other";
  /** @deprecated use overlays */
  overlaySrc: string | null;
  overlays: VideoOverlay[];
  missingMedia: boolean;
}

export interface Timeline {
  version: number;
  episode: string;
  max_id: string;
  fps: number;
  width: number;
  height: number;
  durationInFrames: number;
  /** Composition frame when master VO begins (after m000 title preroll). */
  audioFromFrame?: number;
  /** Omit when episode has no master VO (e.g. sandbox). */
  audioSrc?: string;
  /** Burn-in cue + m### labels (from media_tool toggle / preview-settings.json). */
  showCueOverlay?: boolean;
  showStickerOverlays?: boolean;
  shots: Shot[];
  stats: {
    shot_count: number;
    missing_media: number;
    end_sec: number;
  };
}
