import type { CSSProperties } from "react";

/**
 * Size sticker/GIF by frame height (not intrinsic pixels).
 * maxWidth/maxHeight alone on <Img> does not scale small assets up.
 */
export function stickerOverlayLayout(percent: number): {
  box: CSSProperties;
  img: CSSProperties;
} {
  return {
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
