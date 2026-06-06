import { NextRequest, NextResponse } from "next/server";
import {
  LIBRARY_KINDS,
  readAssetMeta,
  updateLibraryAsset,
} from "@/lib/media-library";
import type { LibraryKind } from "@/lib/media-library";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const meta = readAssetMeta(id);
    if (!meta) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }
    return NextResponse.json({ meta });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    const patch: {
      filename?: string;
      tags?: string[];
      manual_notes?: string;
      archived?: boolean;
      kind?: LibraryKind;
    } = {};

    if (Array.isArray(body.tags)) {
      patch.tags = body.tags.map(String);
    }
    if (typeof body.manual_notes === "string") {
      patch.manual_notes = body.manual_notes;
    }
    if (typeof body.filename === "string") {
      patch.filename = body.filename;
    }
    if (typeof body.archived === "boolean") {
      patch.archived = body.archived;
    }
    if (
      typeof body.kind === "string" &&
      (LIBRARY_KINDS as readonly string[]).includes(body.kind)
    ) {
      patch.kind = body.kind as LibraryKind;
    }

    const meta = updateLibraryAsset(id, patch);
    return NextResponse.json({ ok: true, meta });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    const status = message.includes("Unknown library asset")
      ? 404
      : message.includes("Invalid filename") ||
          message.includes("File not found on disk")
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
