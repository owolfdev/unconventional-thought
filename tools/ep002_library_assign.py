#!/usr/bin/env python3
"""Assign _library plates to episode 002 acquisitions (replaces GIPHY placeholders)."""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Tuple, Union

REPO = Path(__file__).resolve().parents[1]
EPISODE = "002_DidBonScottKnowHeWasGoingToDie"
MANIFEST = REPO / f"episodes/{EPISODE}/timeline/media_search.json"
LIB_INDEX = REPO / "media_tool/public/media/_library/index.json"
LIB_ROOT = REPO / "media_tool/public/media/_library/assets"
MEDIA_ROOT = REPO / f"media_tool/public/media/{EPISODE}"

# library_id -> optional kwargs: start_from_sec, text_layer (use manifest text on plate)
Assignment = Union[str, Tuple[str, Dict[str, Any]]]

# Hand-picked plates: Bon-forward where the VO is about Bon; artifacts/tags elsewhere.
ASSIGNMENTS: dict[str, Assignment] = {
    # --- Cold open / voice shift (Bon-heavy) ---
    "m001": "aadb15e60b8c24f1",  # dark-bon.webp — thesis portrait
    "m002": "5bb3fe8890c73da8",  # swaggerbon.jpg — fame / bargain
    "m003": "fe58b90977ea9f80",  # IMG_5733 highway to hell
    "m004": "673973583e79f97e",  # his-actual-voice.jpg
    "m005": "2f0ea3cc0654a22e",  # bonscott_onstage-1 — early fight energy
    "m006": ("68fc3d54b08176f3", {"text_layer": True}),
    "m007": "4ff8bdb1dd269eac",  # specific-guy bad reputation
    "m008": "6467d75980c5b530",  # always-a-fight — upstream energy
    "m009": "93ea4a896d8fe652",  # bon on stage.webp — looser 1979
    "m010": "0941eb9f5822f6a9",  # vintage microphone (not alcohol)
    "m011": "e5b37fdb94b561a0",  # witty-bon.jpg
    "m012": ("bd1748b0e95e182b", {"text_layer": True}),  # handwritten Highway lyrics
    "m013": "e29b6eb53267fb4c",  # pure swagger live
    "m014": "ed8e308c7338323e",  # highway-to-hell best work
    # --- Folklore pivot (no Johnson in library — guitar/era texture) ---
    "m015": "48dfd3398fc95955",  # jury/crowd — rock scene everyone knew
    "m016": "b12605b9584934f4",  # peeling poster — era texture
    "m017": "1dd39fa1aa727ec4",  # motorcycles-skid — lonely road mood
    "m018": "26ab6d3b97f4b999",  # electric guitar body — young musician
    "m019": "ddda0343e765d356",  # detective.jpg — dark figure mood
    "m020": "cf62434c1ec966c1",  # handwritten lyrics — impossibly good
    "m021": ("2188dff0cf0d5089", {"text_layer": True}),  # reel-to-reel + intertitle
    "m022": "5771ff5aa07ec028",  # download-inv — transformed return
    "m023": "673973583e79f97e",  # voice again — otherworldly
    "m024": "53f3d23509394c09",  # bond-scott-dies feb 1980 — died before fame parallel
    "m025": "d408c69e2da9da35",  # nine lives — 27 club roll
    "m026": "76f77f9627a4d5b3",  # something-happening — soul for art
    # --- Devil / heroin ---
    "m027": "d83d6b1e6a60a42f",  # gold disc
    "m028": ("aadb15e60b8c24f1", {"text_layer": True}),  # 33. over dark-bon portrait
    "m029": ("ddda0343e765d356", {"text_layer": True}),
    "m030": "0941eb9f5822f6a9",  # mic stand-in for needle macro
    "m031": "f5601164014787ba",  # crystal chandelier — elite rooms
    "m032": "dc04219f2b754661",  # bib-record vinyl stack
    "m033": "fa39a51774bb3241",  # those-songs fingerprint / collection
    "m034": "8d177a2e301995e1",  # funny bon — survived
    "m035": "5c07e1ac64c1fdaf",  # crystal chandelier gif — saturated culture
    "m036": "e86f76483704e4b7",  # respect gif — afterparty circuit
    "m037": "9398594e9a4d861e",  # generic era (no Lennon in lib)
    "m038": "04dd70e203071d02",  # geordie — rock doc era
    "m039": ("6510a1713cd66954", {"text_layer": True}),  # perfect rock record
    # --- Bon proximity / death ---
    "m040": "420996400b79b637",  # but-heres-the-thing-about-bond-scott
    "m041": "7c57afe3d05b94ca",  # original frontman 1979 — final stretch
    "m042": ("0d61d90cad7217bd", {"text_layer": True}),  # thinking man — you decide
    "m043": "39c25ce872dd60d8",  # dead five months — death night London
    "m044": "e0dbf750d480f528",  # nearly-kills-him — car/night
    "m045": "010fdce190078de0",  # wait convenience — thin public record
    "m046": "8d177a2e301995e1",  # funny bon drinking
    "m047": "f2b330b1796be50a",  # great-story-very-convenient
    "m048": "e0dbf750d480f528",  # left in car
    "m049": "e0dbf750d480f528",  # winter night (reuse — remix later)
    "m050": "afcb87ea5b3498d4",  # look.png — afternoon delay
    # --- 1980 cultural / commercial ---
    "m051": "17440123a856d974",  # cover-up mood
    "m052": "cb5d996f1cdae9ce",  # lets-look-at-the-facts 1980
    "m053": "5c07e1ac64c1fdaf",  # disco elite
    "m054": "955c769468f3a062",  # acdc 1979 billboard — US market
    "m055": "674b2c3f2044be34",  # jury crowd — demographic
    "m056": "35727d85900ce2bb",  # vintage tour shirt — denim crowd
    "m057": "094f27350f2e7c95",  # brian/angus/malcolm — downtown art adjacency
    "m058": "0d61d90cad7217bd",  # thinking man — stigma contrast
    "m059": "bc7f2e58967c2ffa",  # bon_and_angus — joy machine
    "m060": "f9f39c4301aaab48",  # back in black uk vinyl
    "m061": ("0b35e485f1110e2f", {"start_from_sec": 0.0}),  # back in black video
    "m062": "d3463c98df6c20fe",  # theres-no-wink — advertisers
    "m063": "b8ccbdb02d5fde6a",  # five months later BIB
    "m064": "d83d6b1e6a60a42f",  # gold disc — 50M
    "m065": "3a44b54bee2b591f",  # tells privately — self-preservation
    "m066": ("c7eefae85ab039c9", {"text_layer": True}),  # bond wrote lyrics — thesis return
    "m067": "2f0ea3cc0654a22e",  # still playing on stage
    "m068": "48dfd3398fc95955",  # crowd — we consumed it
    "m069": ("961568fea3dfcaba", {"start_from_sec": 0.0}),  # highway live trim video
}


def load_library() -> dict[str, dict]:
    index = json.loads(LIB_INDEX.read_text(encoding="utf-8"))
    by_id: dict[str, dict] = {}
    for row in index.get("assets") or []:
        if row.get("archived"):
            continue
        aid = row["id"]
        meta_path = LIB_ROOT / aid / "meta.json"
        meta = json.loads(meta_path.read_text(encoding="utf-8")) if meta_path.is_file() else {}
        by_id[aid] = {**row, "meta": meta}
    return by_id


def library_selection(
    asset: dict,
    query: str,
) -> dict[str, Any]:
    aid = asset["id"]
    url = asset["public_url"]
    license_note = asset.get("meta", {}).get("license") or "verify rights before use"
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    return {
        "result_id": f"library:{aid}",
        "url": url,
        "thumbnail_url": asset.get("thumbnail_url") or url,
        "title": asset.get("filename") or aid,
        "source_page": url,
        "license": license_note,
        "engine_id": "library",
        "query": query,
        "selected_at": now,
    }


def is_overlay_selection(s: dict) -> bool:
    eid = s.get("engine_id") or ""
    if eid in ("giphy_sticker", "openai_sticker", "openai_title"):
        return True
    blob = f"{s.get('result_id', '')} {s.get('url', '')}".lower()
    return any(p in blob for p in ("giphy-", "sticker-", "title-"))


def apply_cue(
    item: dict,
    assignment: Assignment | None,
    lib: dict[str, dict],
) -> str:
    item_id = item["id"]
    acq_path = MEDIA_ROOT / item_id / "acquisition.json"
    if not acq_path.is_file():
        return "no_acq"

    acq = json.loads(acq_path.read_text(encoding="utf-8"))
    mode = item.get("visual_mode", "historical")

    if assignment is None:
        if mode == "text_graphic":
            acq["resolved_visual_mode"] = "text_graphic"
            acq["status"] = "text_graphic"
        return "skipped"

    if isinstance(assignment, tuple):
        lib_id, opts = assignment
    else:
        lib_id, opts = assignment, {}

    asset = lib.get(lib_id)
    if not asset:
        return f"missing_lib:{lib_id}"

    sq = item.get("search_queries") or []
    sel = library_selection(asset, sq[0] if sq else item_id)
    if opts.get("start_from_sec") is not None:
        sec = float(opts["start_from_sec"])
        if sec > 0:
            sel["start_from_sec"] = sec

    queries = acq.get("queries") or []
    if not queries:
        queries = [
            {
                "query_index": 0,
                "query": "library",
                "engine_id": "library",
                "engine_url": "",
                "selections": [],
            }
        ]

    # Single library plate on first query; clear other query slots.
    stripped = []
    for i, q in enumerate(queries):
        stripped.append(
            {
                **q,
                "selections": [sel] if i == 0 else [],
            }
        )
    acq["queries"] = stripped

    acq["sticker_overlay_enabled"] = False
    acq["sticker_overlay_size"] = "medium"

    tg = item.get("text_graphic")
    if opts.get("text_layer") and tg:
        acq["resolved_visual_mode"] = "historical"
        acq["text_graphic"] = None
        acq["text_graphic_layer"] = tg
        acq["resolved_media_type"] = "photo"
    elif mode == "text_graphic":
        acq["resolved_visual_mode"] = "text_graphic"
        acq["text_graphic"] = tg
        acq["text_graphic_layer"] = None
        acq["resolved_media_type"] = "generated"
    elif mode == "effect_only":
        acq["resolved_visual_mode"] = "effect_only"
        acq["resolved_media_type"] = "generated"
    else:
        acq["resolved_visual_mode"] = mode
        acq["resolved_media_type"] = asset.get("media_type") or "photo"

    if not acq.get("effects"):
        acq["effects"] = ["film_scratches"]

    note = "[Library pass — verify license before publish]"
    notes = (acq.get("notes") or "").replace(
        "[GIPHY placeholder pass — replace plate/sticker before publish]", ""
    ).strip()
    if note not in notes:
        notes = f"{notes}\n{note}".strip() if notes else note
    acq["notes"] = notes
    acq["status"] = "complete" if acq["resolved_visual_mode"] != "text_graphic" else "text_graphic"
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    acq["completed_at"] = now
    acq["updated_at"] = now

    acq_path.write_text(json.dumps(acq, indent=2) + "\n", encoding="utf-8")
    return f"ok:{asset.get('filename')}"


def main() -> int:
    lib = load_library()
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    results: dict[str, str] = {}
    bon_cues: list[str] = []

    for item in manifest["items"]:
        cid = item["id"]
        if cid == "m070":
            continue
        people = {p.get("name", "").lower() for p in item.get("people") or []}
        if "bon scott" in people or "bond scott" in (item.get("spoken") or "").lower():
            bon_cues.append(cid)

        results[cid] = apply_cue(item, ASSIGNMENTS.get(cid), lib)

    ok = sum(1 for v in results.values() if v.startswith("ok:"))
    print(f"Assigned {ok} cues from library ({len(ASSIGNMENTS)} mapped)")
    print(f"Bon-forward cues in manifest: {', '.join(bon_cues)}")
    print("\nBon image assignments:")
    for cid in bon_cues:
        a = ASSIGNMENTS.get(cid)
        if not a:
            print(f"  {cid}: (no assignment)")
            continue
        lid = a[0] if isinstance(a, tuple) else a
        asset = lib.get(lid, {})
        print(f"  {cid}: {asset.get('filename', lid)}")

    errors = [f"{k}: {v}" for k, v in results.items() if v.startswith("missing")]
    if errors:
        print("\nErrors:")
        for e in errors:
            print(" ", e)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
