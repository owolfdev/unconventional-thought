/** Parsed from Remotion CLI stdout (matches terminal output). */
export type RenderProgressPhase =
  | "starting"
  | "bundling"
  | "compositing"
  | "rendering"
  | "encoding"
  | "done";

export interface RenderProgress {
  phase: RenderProgressPhase;
  label: string;
  percent?: number;
  frameCurrent?: number;
  frameTotal?: number;
}

export function parseRenderProgressLine(line: string): RenderProgress | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const bundling = trimmed.match(/^Bundling\s+(\d+)%/i);
  if (bundling) {
    const pct = Number(bundling[1]);
    return {
      phase: "bundling",
      percent: pct,
      label: `Bundling ${pct}%`,
    };
  }

  const rendered = trimmed.match(
    /^Rendered\s+(\d+)\/(\d+)(?:,\s*time remaining:\s*(.+))?$/i,
  );
  if (rendered) {
    const frameCurrent = Number(rendered[1]);
    const frameTotal = Number(rendered[2]);
    const eta = rendered[3]?.trim();
    const percent =
      frameTotal > 0
        ? Math.min(100, Math.round((frameCurrent / frameTotal) * 100))
        : undefined;
    return {
      phase: "rendering",
      frameCurrent,
      frameTotal,
      percent,
      label: eta
        ? `Rendered ${frameCurrent}/${frameTotal} · ${eta} remaining`
        : `Rendered ${frameCurrent}/${frameTotal}`,
    };
  }

  const encoded = trimmed.match(/^Encoded\s+(\d+)\/(\d+)/i);
  if (encoded) {
    const frameCurrent = Number(encoded[1]);
    const frameTotal = Number(encoded[2]);
    const percent =
      frameTotal > 0
        ? Math.min(100, Math.round((frameCurrent / frameTotal) * 100))
        : undefined;
    return {
      phase: "encoding",
      frameCurrent,
      frameTotal,
      percent,
      label: `Encoded ${frameCurrent}/${frameTotal}`,
    };
  }

  if (/^Getting composition/i.test(trimmed)) {
    return { phase: "compositing", label: "Getting composition…" };
  }

  if (/^Composition\s+/i.test(trimmed)) {
    return { phase: "compositing", label: trimmed };
  }

  return null;
}

/** Walk log text and return the latest progress snapshot. */
export function latestProgressFromLog(log: string): RenderProgress | null {
  const lines = log.split("\n");
  let latest: RenderProgress | null = null;
  for (const line of lines) {
    const p = parseRenderProgressLine(line);
    if (p) latest = p;
  }
  return latest;
}

export function tailLogLines(log: string, maxLines = 48): string {
  const lines = log.split("\n");
  if (lines.length <= maxLines) return log;
  return lines.slice(-maxLines).join("\n");
}
