import type { CSSProperties } from "react";
import type { StickerOverlayPosition } from "./types";

/** Size sticker/GIF by preview frame height (matches Remotion ShotClip). */
export function stickerOverlayLayout(
  percent: number,
  position: StickerOverlayPosition = "center",
): {
  container: CSSProperties;
  box: CSSProperties;
  img: CSSProperties;
} {
  const alignItems =
    position === "left" ||
    position === "top_left" ||
    position === "bottom_left"
      ? "flex-start"
      : position === "right" ||
          position === "top_right" ||
          position === "bottom_right"
        ? "flex-end"
        : "center";
  const justifyContent =
    position === "top" ||
    position === "top_left" ||
    position === "top_right"
      ? "flex-start"
      : position === "bottom" ||
          position === "bottom_left" ||
          position === "bottom_right"
        ? "flex-end"
        : "center";
  return {
    container: {
      position: "absolute",
      inset: 0,
      display: "flex",
      alignItems,
      justifyContent,
      padding: "5%",
      pointerEvents: "none",
    },
    box: {
      height: `${percent}%`,
      maxWidth: `${percent}%`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    img: {
      height: "100%",
      width: "auto",
      maxWidth: "100%",
      objectFit: "contain",
    },
  };
}
