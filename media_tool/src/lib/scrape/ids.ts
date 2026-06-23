import { createHash } from "node:crypto";

/** Stable session id for a scraped hit (spec: google-<hash>, youtube-<hash>). */
export function scrapeResultId(
  prefix: "google" | "youtube" | "bing",
  key: string,
): string {
  const hash = createHash("sha256").update(key).digest("hex").slice(0, 12);
  return `${prefix}-${hash}`;
}
