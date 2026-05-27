import type { Shot } from "./types";

/** Burn-in labels for editorial sync (toggle via media_tool → preview-settings.json). */
export const CueIdOverlay: React.FC<{ shot: Shot }> = ({ shot }) => {
  return (
    <div
      style={{
        position: "absolute",
        top: 20,
        left: 20,
        zIndex: 50,
        pointerEvents: "none",
        fontFamily:
          'ui-monospace, SFMono-Regular, Menlo, "JetBrains Mono", monospace',
        fontWeight: 700,
        letterSpacing: "0.06em",
        lineHeight: 1.3,
        color: "#ffffff",
        backgroundColor: "rgba(0,0,0,0.72)",
        border: "1px solid rgba(255,255,255,0.25)",
        borderRadius: 8,
        padding: "10px 16px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
      }}
    >
      <div style={{ fontSize: 15, opacity: 0.8, marginBottom: 4 }}>
        CUE {shot.cue}
      </div>
      <div style={{ fontSize: 30, letterSpacing: "0.08em" }}>{shot.id}</div>
    </div>
  );
};
