import { NextResponse } from "next/server";
import { listEpisodes } from "@/lib/episodes";

export async function GET() {
  return NextResponse.json({ episodes: listEpisodes() });
}
