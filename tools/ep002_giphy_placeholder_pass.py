#!/usr/bin/env python3
"""
Download one GIPHY GIF per ep002 cue as a placeholder (sticker on black).

Writes giphy-<id>.gif into media_tool/public/media/002_.../m###/acquired/
and updates acquisition.json (large sticker, status=complete).

Requires GIPHY_API_KEY in media_tool/.env.local.
Preview: black plate + 90% frame-height GIF — good for rhythm pass, not final grade.

Usage:
  python3 tools/ep002_giphy_placeholder_pass.py --dry-run
  python3 tools/ep002_giphy_placeholder_pass.py
  python3 tools/ep002_giphy_placeholder_pass.py --from m010 --to m020
"""

from __future__ import annotations

import argparse
import json
import re
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
EPISODE = "002_DidBonScottKnowHeWasGoingToDie"
MANIFEST = REPO / f"episodes/{EPISODE}/timeline/media_search.json"
MEDIA_ROOT = REPO / f"media_tool/public/media/{EPISODE}"
ENV_FILE = REPO / "media_tool/.env.local"
GIPHY_API = "https://api.giphy.com/v1/gifs/search"
LICENSE = "GIPHY — verify broadcast/editorial rights (giphy.com/terms)"
ENGINE = "giphy_sticker"

# Cue-specific GIPHY-friendly queries (wit > literal archive terms).
GIPHY_QUERY: dict[str, str] = {
    "m000": "typing text vintage",
    "m001": "bon scott acdc rock",
    "m002": "deal with devil",
    "m003": "highway to hell rock",
    "m004": "singing microphone rock",
    "m005": "angry rock singer",
    "m006": "coiled spring tension",
    "m007": "ready to fight",
    "m008": "rock concert energy",
    "m009": "chill relaxed vibe",
    "m010": "not drunk sober",
    "m011": "supernatural calm",
    "m012": "highway hell lyrics",
    "m013": "acceptance peace",
    "m014": "masterpiece rock",
    "m015": "backstage musicians talking",
    "m016": "mississippi night road",
    "m017": "lonely crossroads",
    "m018": "robert johnson blues guitar",
    "m019": "devil crossroads",
    "m020": "blues guitar magic",
    "m021": "nothing is free",
    "m022": "robert johnson blues",
    "m023": "blues singer soul",
    "m024": "early death legend",
    "m025": "27 club rock death",
    "m026": "sold soul fame",
    "m027": "money gold record",
    "m028": "number 33",
    "m029": "who is the devil",
    "m030": "syringe needle dark",
    "m031": "heroin documentary",
    "m032": "vinyl record collection",
    "m033": "rock studio 1970s",
    "m034": "rock star survived",
    "m035": "studio 54 disco",
    "m036": "after party rock",
    "m037": "john lennon",
    "m038": "eric clapton lou reed",
    "m039": "rock history documentary",
    "m040": "bon scott london",
    "m041": "tired rock star",
    "m042": "you decide",
    "m043": "london night winter",
    "m044": "car parked night",
    "m045": "newspaper headline shock",
    "m046": "drinking beer pub",
    "m047": "classified document redacted",
    "m048": "abandoned car night",
    "m049": "freezing cold winter",
    "m050": "clock afternoon late",
    "m051": "media silence cover up",
    "m052": "1980 television news",
    "m053": "disco dance floor",
    "m054": "acdc crowd concert",
    "m055": "american rock denim crowd",
    "m056": "disco demolition explosion",
    "m057": "andy warhol factory",
    "m058": "culture war contrast",
    "m059": "rock concert joy",
    "m060": "back in black vinyl",
    "m061": "radio station dj",
    "m062": "tv commercial 1980",
    "m063": "record store 1980",
    "m064": "platinum gold record",
    "m065": "business handshake deal",
    "m066": "bon scott thinking",
    "m067": "rock star running stage",
    "m068": "concert crowd cheering",
    "m069": "highway to hell acdc",
}


def load_giphy_key() -> str:
    if not ENV_FILE.is_file():
        raise SystemExit(f"Missing {ENV_FILE}")
    for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line.startswith("GIPHY_API_KEY="):
            key = line.split("=", 1)[1].strip()
            if key:
                return key
    raise SystemExit("GIPHY_API_KEY not set in media_tool/.env.local")


def giphy_filename(giphy_id: str) -> str:
    safe = re.sub(r"[^\w-]", "", giphy_id)[:40] or "gif"
    return f"giphy-{safe}.gif"


def default_query(item: dict) -> str:
    cid = item["id"]
    if cid in GIPHY_QUERY:
        return GIPHY_QUERY[cid]
    sq = item.get("search_queries") or []
    if sq:
        return sq[0][:50]
    tg = item.get("text_graphic") or {}
    if tg.get("text"):
        return str(tg["text"])[:40]
    spoken = (item.get("spoken") or "").strip()
    if spoken:
        return " ".join(spoken.split()[:5])
    return (item.get("situation") or "rock documentary")[:50]


def search_giphy(api_key: str, query: str) -> dict | None:
    params = urllib.parse.urlencode(
        {
            "api_key": api_key,
            "q": query,
            "limit": "5",
            "offset": "0",
            "rating": "pg",
            "lang": "en",
        }
    )
    req = urllib.request.Request(
        f"{GIPHY_API}?{params}",
        headers={"User-Agent": "UnconventionalThought/placeholder-pass"},
    )
    with urllib.request.urlopen(req, timeout=30) as res:
        body = json.loads(res.read().decode("utf-8"))
    for gif in body.get("data") or []:
        images = gif.get("images") or {}
        rend = (
            images.get("downsized_medium")
            or images.get("fixed_height")
            or images.get("downsized")
            or images.get("original")
        )
        url = (rend or {}).get("url", "").strip()
        if url and gif.get("id"):
            return {
                "id": gif["id"],
                "title": (gif.get("title") or gif["id"]).strip(),
                "download_url": url,
            }
    return None


def download_bytes(url: str) -> bytes:
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "UnconventionalThought/placeholder-pass"},
    )
    with urllib.request.urlopen(req, timeout=60) as res:
        data = res.read()
    if len(data) < 32:
        raise ValueError("empty download")
    return data


def selection_dict(
    project: str,
    item_id: str,
    filename: str,
    giphy_query: str,
    title: str,
) -> dict:
    href = f"/media/{project}/{item_id}/acquired/{urllib.parse.quote(filename)}"
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    return {
        "result_id": f"local-acquired:{filename}",
        "url": href,
        "thumbnail_url": href,
        "title": filename,
        "source_page": href,
        "license": LICENSE,
        "engine_id": ENGINE,
        "query": f"GIPHY placeholder: {giphy_query} — {title[:80]}",
        "selected_at": now,
    }


def _is_giphy_selection(s: dict) -> bool:
    if s.get("engine_id") == ENGINE:
        return True
    url = (s.get("url") or "").lower()
    rid = (s.get("result_id") or "").lower()
    return "giphy-" in url or "giphy-" in rid


def strip_giphy_selections(acq: dict) -> dict:
    """Remove prior giphy selections before re-import."""
    queries = acq.get("queries") or []
    cleaned = []
    for q in queries:
        sels = [s for s in q.get("selections") or [] if not _is_giphy_selection(s)]
        cleaned.append({**q, "selections": sels})
    acq["queries"] = cleaned
    return acq


def giphy_only_selections(acq: dict) -> dict:
    """Placeholder pass: giphy sticker only (no archive plate underneath)."""
    queries = acq.get("queries") or []
    acq["queries"] = [
        {**q, "selections": [s for s in q.get("selections") or [] if _is_giphy_selection(s)]}
        for q in queries
    ]
    return acq


def apply_cue(
    item: dict,
    api_key: str,
    *,
    dry_run: bool,
    force: bool,
) -> str:
    item_id = item["id"]
    if item_id == "m070":
        return "skip_tail"

    acq_path = MEDIA_ROOT / item_id / "acquisition.json"
    if not acq_path.is_file():
        return "no_acquisition"

    acq = json.loads(acq_path.read_text(encoding="utf-8"))
    acquired_dir = MEDIA_ROOT / item_id / "acquired"
    existing_giphy = sorted(acquired_dir.glob("giphy-*.gif")) if acquired_dir.is_dir() else []
    has_giphy_sel = any(
        _is_giphy_selection(s)
        for q in acq.get("queries") or []
        for s in q.get("selections") or []
    )
    if existing_giphy and has_giphy_sel and not force:
        _finalize_placeholder_acq(acq, item)
        acq_path.write_text(json.dumps(acq, indent=2) + "\n", encoding="utf-8")
        return "fixed_existing"

    query = default_query(item)
    if dry_run:
        return f"dry_run:{query}"

    hit = search_giphy(api_key, query)
    if not hit:
        # fallback: simpler query
        hit = search_giphy(api_key, "rock music")
    if not hit:
        return "no_results"

    filename = giphy_filename(hit["id"])
    acquired_dir.mkdir(parents=True, exist_ok=True)
    out_path = acquired_dir / filename
    out_path.write_bytes(download_bytes(hit["download_url"]))

    acq = strip_giphy_selections(acq)
    queries = acq.get("queries") or []
    if not queries:
        queries = [
            {
                "query_index": 0,
                "query": "GIPHY placeholder",
                "engine_id": "giphy_sticker",
                "engine_url": "https://giphy.com/search/{query}",
                "selections": [],
            }
        ]
    sel = selection_dict(EPISODE, item_id, filename, query, hit["title"])
    queries[0] = {
        **queries[0],
        "selections": [sel, *queries[0].get("selections", [])],
    }
    acq["queries"] = queries
    _finalize_placeholder_acq(acq, item)
    acq["completed_at"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    acq["updated_at"] = acq["completed_at"]
    acq_path.write_text(json.dumps(acq, indent=2) + "\n", encoding="utf-8")
    return f"ok:{filename}"


def _finalize_placeholder_acq(acq: dict, item: dict) -> None:
    acq = giphy_only_selections(acq)
    acq["sticker_overlay_enabled"] = True
    acq["sticker_overlay_size"] = "large"
    acq["background_color"] = acq.get("background_color") or "#000000"
    if not acq.get("effects"):
        acq["effects"] = ["film_scratches"]
    note_tag = "[GIPHY placeholder pass — replace plate/sticker before publish]"
    notes = (acq.get("notes") or "").strip()
    if note_tag not in notes:
        notes = f"{notes}\n{note_tag}".strip()
    acq["notes"] = notes
    acq["status"] = "complete"
    acq["resolved_media_type"] = "photo"
    acq["resolved_visual_mode"] = "effect_only"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--force", action="store_true", help="Re-download even if giphy exists")
    parser.add_argument("--from", dest="from_id", default="m000")
    parser.add_argument("--to", dest="to_id", default="m069")
    parser.add_argument("--sleep", type=float, default=0.35, help="Seconds between API calls")
    args = parser.parse_args()

    api_key = load_giphy_key()
    data = json.loads(MANIFEST.read_text(encoding="utf-8"))
    items = data["items"]

    def in_range(item_id: str) -> bool:
        n = int(item_id[1:])
        return int(args.from_id[1:]) <= n <= int(args.to_id[1:])

    results: dict[str, str] = {}
    for item in items:
        if not in_range(item["id"]):
            continue
        try:
            results[item["id"]] = apply_cue(
                item, api_key, dry_run=args.dry_run, force=args.force
            )
        except Exception as e:
            results[item["id"]] = f"error:{e}"
        if not args.dry_run and results[item["id"]].startswith("ok:"):
            time.sleep(args.sleep)

    ok = sum(
        1
        for v in results.values()
        if v.startswith("ok:")
        or v.startswith("dry_run:")
        or v == "fixed_existing"
    )
    skip = sum(1 for v in results.values() if v in ("skip_tail", "already", "no_acquisition"))
    fail = len(results) - ok - skip
    print(f"Processed {len(results)} cues — ok/dry:{ok} skip:{skip} fail:{fail}")
    for cid, status in sorted(results.items(), key=lambda x: int(x[0][1:])):
        if status.startswith("error:") or status == "no_results":
            print(f"  {cid}: {status}")
    return 0 if fail == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
