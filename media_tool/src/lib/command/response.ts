import type { ResponseLine } from "./types";

export const MAX_RESPONSE_LINES = 40;

export function appendResponseLine(
  lines: ResponseLine[],
  text: string,
  tone: ResponseLine["tone"] = "info",
): ResponseLine[] {
  return [...lines.slice(-MAX_RESPONSE_LINES + 1), { text, tone }];
}

export function pushResponseLine(
  setLines: (fn: (prev: ResponseLine[]) => ResponseLine[]) => void,
  text: string,
  tone: ResponseLine["tone"] = "info",
): void {
  setLines((prev) => appendResponseLine(prev, text, tone));
}
