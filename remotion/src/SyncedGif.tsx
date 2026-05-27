import { Gif } from "@remotion/gif";
import type { CSSProperties } from "react";
import { staticFile } from "remotion";

type Props = {
  /** Path under public/ (same as staticFile). */
  src: string;
  width: number;
  height: number;
  fit?: "fill" | "contain" | "cover";
  style?: CSSProperties;
  loopBehavior?: "loop" | "pause-after-finish" | "unmount-after-finish";
};

/**
 * GIF decoded per Remotion frame — not browser autoplay (which races during render).
 */
export const SyncedGif: React.FC<Props> = ({
  src,
  width,
  height,
  fit = "contain",
  style,
  loopBehavior = "loop",
}) => (
  <Gif
    src={staticFile(src)}
    width={Math.max(1, Math.round(width))}
    height={Math.max(1, Math.round(height))}
    fit={fit}
    loopBehavior={loopBehavior}
    style={style}
  />
);
