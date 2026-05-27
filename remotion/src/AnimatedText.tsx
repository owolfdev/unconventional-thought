import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { interpretAcquisitionNotes } from "./acquisition-notes";
import {
  activeCommaBlockIndex,
  blockDurationFrames,
  localBlockFrame,
} from "./comma-block-timing";
import { getMotionStyle } from "./motion-effects";
import type { TextGraphicSpec } from "./types";

type Props = {
  spec: TextGraphicSpec | null;
  spoken: string;
  effects: string[];
  durationInFrames: number;
  /** Full-cue typography (bigger) vs overlay layer */
  primary?: boolean;
  notes?: string | null;
  /** VO-aligned comma phrase starts (from timeline builder + transcript). */
  textBlockStartFrames?: number[];
  /** Typewriter reveal speed (>1 = faster). */
  textRevealSpeedMult?: number;
};

function effectiveTextLength(text: string): number {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length > 1) {
    return Math.max(...lines.map((line) => line.length));
  }
  return text.length;
}

function fontSizeForText(
  text: string,
  primary: boolean,
  mult: number,
): number {
  const len = effectiveTextLength(text);
  let base: number;
  if (!primary) {
    base = len <= 24 ? 52 : 40;
  } else if (len <= 12) {
    base = 132;
  } else if (len <= 28) {
    base = 96;
  } else if (len <= 55) {
    base = 72;
  } else {
    base = 58;
  }
  return Math.round(base * mult);
}

function fontForStyle(style: string): string {
  const s = style.toLowerCase();
  if (s.includes("typewriter")) {
    return '"SF Mono", "JetBrains Mono", ui-monospace, Menlo, monospace';
  }
  if (s.includes("neon")) {
    return '"Helvetica Neue", Helvetica, Arial, sans-serif';
  }
  return 'Impact, "Arial Black", "Helvetica Neue", Helvetica, sans-serif';
}

function isBoldStyle(style: string): boolean {
  const s = style.toLowerCase();
  return (
    s.includes("bold") ||
    s.includes("rock") ||
    s.includes("title") ||
    s.includes("stamp") ||
    s.includes("neon")
  );
}

function extrudedShadow(layers: number, rgb: string): string {
  const parts: string[] = [];
  for (let i = 1; i <= layers; i++) {
    parts.push(`${i}px ${i}px 0 rgba(${rgb}, ${0.35 + i * 0.04})`);
  }
  parts.push(`0 ${layers + 4}px 28px rgba(0,0,0,0.75)`);
  return parts.join(", ");
}

function revealWords(text: string, frame: number, duration: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "";
  const revealEnd = Math.max(1, Math.floor(duration * 0.84));
  const shown = Math.floor(
    interpolate(frame, [0, revealEnd], [0, words.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
  return words.slice(0, shown).join(" ");
}

/** Character-at-a-time typewriter for short punchy lines. */
function revealPunchyTypewriter(
  text: string,
  frame: number,
  duration: number,
  speedMult: number,
): string {
  const chars = text.length;
  if (!chars) return "";
  const mult = Math.max(speedMult, 1.5);
  const revealEnd = Math.max(
    chars,
    Math.floor((duration * 0.38) / mult),
  );
  const shown = Math.min(
    chars,
    Math.ceil(
      interpolate(frame, [0, revealEnd], [0, chars], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }),
    ),
  );
  return text.slice(0, shown);
}

export const AnimatedText: React.FC<Props> = ({
  spec,
  spoken,
  effects,
  durationInFrames,
  primary = false,
  notes = null,
  textBlockStartFrames,
  textRevealSpeedMult = 1,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const nh = interpretAcquisitionNotes(notes, fps);

  const text = (spec?.text?.trim() || spoken).trim();
  if (!text) return null;

  const style = spec?.style ?? "typewriter";
  const styleKey = style.toLowerCase();
  const isTypewriter =
    styleKey.includes("typewriter") && !styleKey.includes("stamp");
  const duration = Math.max(durationInFrames, 1);

  let sizeMult = 1;
  if (nh.textExtraBig) {
    sizeMult *= 1.35;
  }
  if (nh.textXL) {
    sizeMult *= 1.22;
  }
  if (nh.textXXL) {
    sizeMult *= 1.45;
  }
  if (nh.goldShine || nh.extrudedRockTitle) {
    sizeMult *= 1.25;
  }
  if (nh.goldShine && /50\s*million/i.test(text)) {
    sizeMult *= primary ? 1.18 : 1.9;
  }
  if (nh.multiColorBold && /^five[.!?]*$/i.test(text.trim())) {
    sizeMult *= 1.28;
  }

  const commaBlocks = nh.commaSeparatedBlocks
    ? text
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
    : [];
  const voStarts =
    textBlockStartFrames &&
    textBlockStartFrames.length === commaBlocks.length &&
    commaBlocks.length > 1
      ? textBlockStartFrames
      : null;
  const useCommaBlocks = commaBlocks.length > 1;
  const blockIndex = useCommaBlocks
    ? voStarts
      ? activeCommaBlockIndex(frame, voStarts)
      : Math.min(
          Math.floor((frame / duration) * commaBlocks.length),
          commaBlocks.length - 1,
        )
    : 0;
  const activeBlockText = useCommaBlocks
    ? (commaBlocks[blockIndex] ?? text)
    : text;

  const fontSize = fontSizeForText(
    useCommaBlocks ? activeBlockText : text,
    primary || nh.textExtraBig || nh.textXL || nh.textXXL,
    sizeMult,
  );
  const lineHeight = nh.textLooseLeading
    ? 1.62
    : nh.textRelaxedLeading
      ? 1.54
      : nh.textExtraBig
        ? 1.48
        : primary
          ? 1.4
          : 1.32;
  const bold =
    (isBoldStyle(style) || primary || nh.multiColorBold) && !isTypewriter;

  let opacity = 1;
  let scale = 1;
  let translateY = 0;
  let displayText = activeBlockText;
  let letterSpacing = bold ? "0.02em" : "0.04em";

  if (useCommaBlocks) {
    const blockLen = voStarts
      ? blockDurationFrames(blockIndex, voStarts, duration)
      : duration / commaBlocks.length;
    const localFrame = voStarts
      ? localBlockFrame(frame, blockIndex, voStarts, duration)
      : frame - (blockIndex / commaBlocks.length) * duration;
    const fadeFrames = Math.min(4, Math.max(2, Math.floor(blockLen * 0.12)));
    const popFrames = Math.min(12, Math.max(6, Math.floor(blockLen * 0.35)));
    opacity = interpolate(localFrame, [0, fadeFrames], [0, 1], {
      extrapolateRight: "clamp",
    });
    scale = interpolate(localFrame, [0, popFrames], [0.94, 1.02], {
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    });
    translateY = interpolate(localFrame, [0, popFrames], [8, 0], {
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    });
  } else if (styleKey.includes("typewriter") && !styleKey.includes("stamp")) {
    const punchy = nh.textPunchyTypewriter || textRevealSpeedMult > 1;
    const speedMult = Math.max(textRevealSpeedMult, punchy ? 2.5 : 1);
    if (punchy) {
      displayText = revealPunchyTypewriter(text, frame, duration, speedMult);
      opacity = interpolate(frame, [0, 3], [0, 1], {
        extrapolateRight: "clamp",
      });
      scale = interpolate(frame, [0, 6], [0.94, 1], {
        extrapolateRight: "clamp",
        easing: Easing.out(Easing.cubic),
      });
    } else {
      displayText = revealWords(text, frame, duration);
      opacity = interpolate(frame, [0, 6], [0, 1], {
        extrapolateRight: "clamp",
      });
    }
  } else if (
    nh.textStartEarly &&
    (styleKey.includes("title") || styleKey.includes("blockbuster"))
  ) {
    opacity = 1;
    scale = interpolate(frame, [0, 8], [0.96, 1], {
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    });
  } else if (styleKey.includes("stamp")) {
    scale = interpolate(frame, [0, Math.min(14, duration * 0.35)], [1.35, 1], {
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    });
    opacity = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp" });
  } else if (styleKey.includes("neon")) {
    const flicker =
      0.55 +
      0.45 *
        (0.5 +
          0.5 * Math.sin(frame * 0.9) * Math.sin(frame * 0.37 + 1.2));
    opacity = flicker;
    scale = interpolate(frame, [0, duration * 0.25], [0.92, 1], {
      extrapolateRight: "clamp",
    });
    letterSpacing = "0.12em";
  } else if (styleKey.includes("minimal")) {
    opacity = interpolate(frame, [0, duration * 0.2], [0, 1], {
      extrapolateRight: "clamp",
    });
    scale = interpolate(frame, [0, duration * 0.35], [0.94, 1], {
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.quad),
    });
  } else {
    opacity = interpolate(frame, [0, 10], [0, 1], {
      extrapolateRight: "clamp",
    });
    scale = interpolate(frame, [0, duration * 0.45], [0.72, 1.06], {
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    });
    translateY = interpolate(frame, [0, duration * 0.45], [28, 0], {
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    });
  }

  const motionFx = getMotionStyle(effects, frame, durationInFrames, null);
  const textTransform =
    [
      `translateY(${translateY}px)`,
      `scale(${scale})`,
      motionFx.transform,
    ]
      .filter(Boolean)
      .join(" ") || undefined;

  const shimmer = interpolate(frame % 90, [0, 45, 90], [0, 1, 0], {
    extrapolateRight: "clamp",
  });
  const bgPos = `${shimmer * 40}% 50%`;

  let color = isTypewriter
    ? "#ffffff"
    : styleKey.includes("minimal")
      ? "#ffffff"
      : styleKey.includes("neon")
        ? "#fffdf2"
        : "#fff3d6";

  let textShadow = isTypewriter
    ? "0 2px 16px rgba(0,0,0,0.55)"
    : styleKey.includes("neon")
      ? "0 0 24px rgba(255,220,120,0.95), 0 0 52px rgba(255,140,60,0.55), 0 3px 18px rgba(0,0,0,0.65)"
      : bold
        ? "0 2px 0 rgba(0,0,0,0.45), 0 6px 18px rgba(0,0,0,0.42), 2px 2px 0 rgba(255,120,80,0.28)"
        : "0 1px 10px rgba(0,0,0,0.35)";

  if (!isTypewriter && nh.extrudedRockTitle) {
    textShadow = extrudedShadow(7, "120,30,10");
  }

  const useGradientFill =
    !isTypewriter && (nh.multiColorBold || nh.goldShine);
  const extrudedOnly =
    !isTypewriter && nh.extrudedRockTitle && !useGradientFill;

  let innerStyle: React.CSSProperties = {
    textAlign: "center",
    fontFamily: fontForStyle(style),
    fontSize,
    fontWeight: isTypewriter ? 600 : bold ? 900 : 700,
    lineHeight,
    letterSpacing,
    textTransform: bold && text.length <= 24 ? "uppercase" : "none",
    textShadow,
    opacity,
    maxWidth: nh.textNarrowColumn ? "46%" : "92%",
    wordBreak: "break-word",
    whiteSpace: text.includes("\n") ? "pre-line" : undefined,
  };

  if (!isTypewriter && nh.goldShine) {
    innerStyle = {
      ...innerStyle,
      color: "transparent",
      backgroundImage:
        "linear-gradient(105deg, #b06a00 0%, #ffd75f 16%, #fffde9 32%, #fff08a 46%, #ffffff 58%, #ffe067 74%, #c87900 100%)",
      backgroundSize: "220% 100%",
      backgroundPosition: bgPos,
      WebkitBackgroundClip: "text",
      backgroundClip: "text",
      WebkitTextFillColor: "transparent",
      filter: `drop-shadow(0 0 14px rgba(255,220,120,0.65)) brightness(${1.08 + 0.12 * Math.sin(frame * 0.2)})`,
    };
  } else if (!isTypewriter && nh.multiColorBold) {
    innerStyle = {
      ...innerStyle,
      color: "transparent",
      backgroundImage:
        "linear-gradient(92deg, #ff5ab1 0%, #fff16a 25%, #73f7ff 50%, #d39bff 75%, #ff5ab1 100%)",
      backgroundSize: "200% 100%",
      backgroundPosition: bgPos,
      WebkitBackgroundClip: "text",
      backgroundClip: "text",
      WebkitTextFillColor: "transparent",
      filter: "drop-shadow(0 0 12px rgba(255,255,255,0.45))",
    };
  } else if (extrudedOnly) {
    innerStyle.color = "#ffe9a8";
  } else {
    innerStyle.color = color;
  }

  if (nh.goldShine && nh.extrudedRockTitle) {
    innerStyle.filter = [
      innerStyle.filter,
      "drop-shadow(0 0 16px rgba(255,230,140,0.55))",
    ]
      .filter(Boolean)
      .join(" ");
  }

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: primary ? 48 : 32,
        pointerEvents: "none",
        transform: textTransform,
        filter: motionFx.filter,
        transformOrigin: "center center",
      }}
    >
      <div style={innerStyle}>{displayText}</div>
    </div>
  );
};
