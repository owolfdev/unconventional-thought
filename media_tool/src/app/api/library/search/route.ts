import { NextRequest, NextResponse } from "next/server";
import {
  parseSearchFieldsParam,
  parseLibraryFormatFilter,
  readLibraryIndex,
  searchFieldsToParam,
  searchLibrary,
} from "@/lib/media-library";
import type { LibraryKind } from "@/lib/media-library";

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    const limit = Number(request.nextUrl.searchParams.get("limit") ?? "20");
    const kindsParam = request.nextUrl.searchParams.get("kinds");
    const kinds = kindsParam
      ? (kindsParam.split(",").filter(Boolean) as LibraryKind[])
      : (["archive"] as LibraryKind[]);
    const searchFields = parseSearchFieldsParam(
      request.nextUrl.searchParams.get("fields"),
    );
    const format = parseLibraryFormatFilter(
      request.nextUrl.searchParams.get("format"),
    );

    if (!q) {
      return NextResponse.json({
        results: [],
        query: q,
        count: 0,
        fields: searchFieldsToParam(searchFields),
        asset_count: readLibraryIndex().asset_count,
      });
    }

    const results = searchLibrary({
      query: q,
      limit: Number.isFinite(limit) ? limit : 20,
      kinds,
      searchFields,
      format,
    });

    return NextResponse.json({
      query: q,
      count: results.length,
      fields: searchFieldsToParam(searchFields),
      format,
      asset_count: readLibraryIndex().asset_count,
      results,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
