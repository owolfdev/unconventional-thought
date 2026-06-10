import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { interpretAcquisitionNotes } from "./acquisition-notes";
import { AnimatedText } from "./AnimatedText";
import { CueIdOverlay } from "./CueIdOverlay";
import { ShotEffectOverlays } from "./EffectVideoOverlay";
import { isGifSrc } from "./is-gif-src";
import { MotionMedia } from "./MotionMedia";
import { activePlateIndex, resolveActivePlate } from "./plate-sequence";
import { stickerOverlayLayout } from "./sticker-overlay-layout";
import { getStickerMotionStyle } from "./sticker-motion";
import { SyncedGif } from "./SyncedGif";
import type { Shot } from "./types";

function toMediaSrc(relativePath: string): string {
  return staticFile(relativePath);
}

const DEFAULT_STICKER_MAX_PERCENT = 62;

export const ShotClip: React.FC<{
  shot: Shot;
  showCueOverlay?: boolean;
}> = ({ shot, showCueOverlay = false }) => {
  const frame = useCurrentFrame();
  const { fps, width: frameW, height: frameH } = useVideoConfig();
  const hints = interpretAcquisitionNotes(shot.notes, fps);
  const delay = Math.max(shot.mediaDelayFrames ?? 0, hints.mediaDelayFrames);

  const isTypography = shot.visualMode === "text_graphic";
  const hasTitleGraphic =
    shot.textGraphic?.type === "title" &&
    Boolean(shot.textGraphic.text?.trim());
  const showEffectOnlyText =
    shot.visualMode === "effect_only" &&
    Boolean(shot.textGraphic?.text?.trim()) &&
    !shot.stickerSrc &&
    !shot.titleOverlaySrc;
  const hasPlate =
    Boolean(shot.src) || Boolean(shot.plateSequence && shot.plateSequence.length > 0);
  const hasTextGraphic = Boolean(shot.textGraphic?.text?.trim());
  const showPlateTypography =
    hasPlate &&
    hasTextGraphic &&
    !shot.stickerSrc &&
    !shot.titleOverlaySrc;
  const showPrimaryTypography =
    isTypography ||
    showEffectOnlyText ||
    hasTitleGraphic ||
    showPlateTypography;
  const typographyPrimary =
    isTypography || showEffectOnlyText || hasTitleGraphic || showPlateTypography;
  const showPlaceholder =
    shot.missingMedia && !showPrimaryTypography;

  const plateCount = shot.plateSequence?.length ?? (shot.src ? 1 : 0);
  const motionFrames = Math.max(1, shot.durationInFrames - delay);
  const plateSegmentFrames =
    plateCount > 1
      ? Math.max(1, Math.floor(motionFrames / plateCount))
      : motionFrames;
  const plateIndex = activePlateIndex(
    frame,
    shot.durationInFrames,
    delay,
    plateCount,
  );
  const activePlate = resolveActivePlate(shot, plateIndex);
  const plateStartFromSec = activePlate?.startFromSec ?? shot.startFromSec ?? 0;
  const hasMedia = Boolean(activePlate) && !shot.missingMedia;
  const bleedPrevious =
    delay > 0 && frame < delay && hasMedia && !isTypography;
  const plateColor = bleedPrevious ? "transparent" : shot.backgroundColor;

  return (
    <AbsoluteFill style={{ backgroundColor: plateColor }}>
      {!isTypography && activePlate?.mediaKind === "image" && (
        <MotionMedia
          key={activePlate.src}
          src={activePlate.src}
          kind="image"
          visualMode={shot.visualMode}
          effects={shot.effects}
          hints={hints}
          frame={frame}
          durationInFrames={shot.durationInFrames}
          mediaDelayFrames={delay}
          mediaScale={shot.mediaScale}
          mediaFit={shot.mediaFit}
          motionTiltDeg={shot.motionTiltDeg}
          motionScrollSpeed={shot.motionScrollSpeed}
        />
      )}

      {!isTypography && activePlate?.mediaKind === "video" && (
        <MotionMedia
          key={`${activePlate.src}:${plateStartFromSec}`}
          src={activePlate.src}
          kind="video"
          visualMode={shot.visualMode}
          effects={shot.effects}
          hints={hints}
          frame={frame}
          durationInFrames={shot.durationInFrames}
          mediaDelayFrames={delay}
          mediaScale={shot.mediaScale}
          mediaFit={shot.mediaFit}
          motionTiltDeg={shot.motionTiltDeg}
          motionScrollSpeed={shot.motionScrollSpeed}
          startFromSec={plateStartFromSec}
          playbackDurationInFrames={plateSegmentFrames}
        />
      )}

      {showPlaceholder && (
        <AbsoluteFill
          style={{
            alignItems: "center",
            justifyContent: "center",
            color: "#666",
            fontFamily: "ui-monospace, monospace",
            fontSize: 22,
            padding: 40,
            textAlign: "center",
          }}
        >
          <div>
            <div style={{ color: "#888", marginBottom: 8 }}>{shot.id}</div>
            <div style={{ maxWidth: 720, fontSize: 16, lineHeight: 1.4 }}>
              {shot.spoken}
            </div>
            <div style={{ marginTop: 12, fontSize: 12, color: "#555" }}>
              (no acquired media yet)
            </div>
          </div>
        </AbsoluteFill>
      )}

      {showPrimaryTypography && shot.textGraphic && (
        <AnimatedText
          spec={shot.textGraphic}
          spoken={shot.spoken}
          effects={shot.effects}
          durationInFrames={shot.durationInFrames}
          primary={typographyPrimary}
          notes={shot.notes}
          textBlockStartFrames={shot.textBlockStartFrames}
          textRevealSpeedMult={shot.textRevealSpeedMult}
        />
      )}

      {shot.textGraphicLayer && (
        <AnimatedText
          spec={shot.textGraphicLayer}
          spoken={shot.spoken}
          effects={shot.effects}
          durationInFrames={shot.durationInFrames}
          primary={false}
          notes={shot.notes}
        />
      )}

      {shot.stickerSrc &&
        (shot.stickerHideAfterSec == null ||
          frame < shot.stickerHideAfterSec * fps) &&
        (() => {
          const pct = shot.stickerMaxPercent ?? DEFAULT_STICKER_MAX_PERCENT;
          const layout = stickerOverlayLayout(pct);
          const gifW = Math.round(frameW * (pct / 100));
          const gifH = Math.round(frameH * (pct / 100));
          const stickerMotion = getStickerMotionStyle(
            shot.stickerEffects,
            frame,
            shot.durationInFrames,
          );
          return (
            <AbsoluteFill
              style={{
                pointerEvents: "none",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div style={{ ...layout.box, ...stickerMotion }}>
                {isGifSrc(shot.stickerSrc) ? (
                  <SyncedGif
                    src={shot.stickerSrc}
                    width={gifW}
                    height={gifH}
                    fit="contain"
                  />
                ) : (
                  <Img src={toMediaSrc(shot.stickerSrc)} style={layout.img} />
                )}
              </div>
            </AbsoluteFill>
          );
        })()}

      {shot.titleOverlaySrc && (
        <AbsoluteFill
          style={{
            pointerEvents: "none",
            alignItems: "flex-end",
            justifyContent: "center",
            paddingBottom: "7%",
          }}
        >
          <Img
            src={toMediaSrc(shot.titleOverlaySrc)}
            style={{
              width: "88%",
              maxHeight: "40%",
              objectFit: "contain",
            }}
          />
        </AbsoluteFill>
      )}

      {shot.effects.includes("film_grain") &&
        !shot.overlays?.some((o) => o.src.includes("/scratches/")) && (
          <AbsoluteFill
            style={{
              opacity: 0.1,
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
              mixBlendMode: "overlay",
              pointerEvents: "none",
            }}
          />
        )}

      {shot.overlays?.map((overlay, i) => (
        <ShotEffectOverlays
          key={`${shot.id}-fx-${i}`}
          overlay={overlay}
          shotDurationInFrames={shot.durationInFrames}
        />
      ))}

      <AbsoluteFill
        style={{
          pointerEvents: "none",
          boxShadow: "inset 0 0 120px rgba(0,0,0,0.55)",
        }}
      />

      {showCueOverlay && <CueIdOverlay shot={shot} />}
    </AbsoluteFill>
  );
};
