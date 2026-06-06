import fs from "fs";
import os from "os";
import path from "path";
import { downloadToAcquired } from "@/lib/download-media";
import { ingestFromBuffer, ingestFromFile } from "./ingest";
import type { IngestContext, IngestResult } from "./types";

export async function downloadUrlToLibrary(
  url: string,
  ctx: IngestContext,
): Promise<IngestResult> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "media-tool-dl-"));
  try {
    const result = await downloadToAcquired(url, tmpDir);
    return ingestFromFile(result.absolutePath, result.filename, {
      ...ctx,
      source_url: ctx.source_url ?? url,
    });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

export function uploadBufferToLibrary(
  data: Buffer,
  originalFilename: string,
  ctx: IngestContext,
): IngestResult {
  return ingestFromBuffer(data, originalFilename, ctx);
}
