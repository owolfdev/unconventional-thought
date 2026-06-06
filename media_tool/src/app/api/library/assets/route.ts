import { NextRequest, NextResponse } from "next/server";
import {
  listLibraryAssets,
  parseSearchFieldsParam,
  searchFieldsToParam,
} from "@/lib/media-library";
import type { LibraryKind } from "@/lib/media-library";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const q = params.get("q")?.trim() ?? "";
    const limit = Number(params.get("limit") ?? "48");
    const offset = Number(params.get("offset") ?? "0");
    const includeArchived = params.get("includeArchived") === "true";
    const kindsParam = params.get("kinds");
    const kinds = kindsParam
      ? (kindsParam.split(",").filter(Boolean) as LibraryKind[])
      : undefined;
    const searchFields = parseSearchFieldsParam(params.get("fields"));

    const result = listLibraryAssets({
      query: q,
      kinds,
      includeArchived,
      limit: Number.isFinite(limit) ? limit : 48,
      offset: Number.isFinite(offset) ? offset : 0,
      searchFields,
    });

    return NextResponse.json({
      query: q,
      fields: searchFieldsToParam(searchFields),
      ...result,
      limit: Number.isFinite(limit) ? limit : 48,
      offset: Number.isFinite(offset) ? offset : 0,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
