import { NextRequest, NextResponse } from "next/server";
import { searchGiphyStickers } from "@/lib/giphy";

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get("q")?.trim();
    if (!q) {
      return NextResponse.json({ error: "q required" }, { status: 400 });
    }

    const limit = Number(request.nextUrl.searchParams.get("limit") ?? "12");
    const offset = Number(request.nextUrl.searchParams.get("offset") ?? "0");
    const results = await searchGiphyStickers(q, limit, offset);

    return NextResponse.json({ ok: true, query: q, results });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
