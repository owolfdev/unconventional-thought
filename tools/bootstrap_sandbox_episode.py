#!/usr/bin/env python3
"""Create / refresh episode 000_Sandbox media_tool folders under public/media/."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
EPISODE = REPO / "episodes" / "000_Sandbox"
MANIFEST_REL = "episodes/000_Sandbox/timeline/media_search.json"
MANIFEST = EPISODE / "timeline" / "media_search.json"
MEDIA_ROOT = REPO / "media_tool" / "public" / "media" / "000_Sandbox"
NOW = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def default_queries(item: dict) -> list:
    queries = item.get("search_queries") or []
    if not queries:
        if item.get("visual_mode") == "text_graphic":
            queries = ["(text graphic — no archive search)"]
        else:
            queries = [item.get("situation") or item.get("editorial_intent", "")[:80]]
    engine_id = (
        "google"
        if item.get("visual_mode") == "text_graphic"
        else "openverse"
        if item.get("visual_mode") == "stock"
        else "commons"
    )
    templates = {
        "google": "https://www.google.com/search?q={query}",
        "openverse": "https://openverse.org/search?q={query}",
        "commons": "https://commons.wikimedia.org/w/index.php?search={query}",
    }
    return [
        {
            "query_index": i,
            "query": q,
            "engine_id": engine_id,
            "engine_url": templates[engine_id],
            "selections": [],
        }
        for i, q in enumerate(queries)
    ]


def item_acquisition(item: dict) -> dict:
    mode = item.get("visual_mode", "historical")
    status = "text_graphic" if mode == "text_graphic" else "pending"
    return {
        "id": item["id"],
        "cue": item["cue"],
        "source_visual_mode": mode,
        "resolved_visual_mode": mode,
        "resolved_media_type": "generated" if mode == "text_graphic" else "photo",
        "status": status,
        "notes": "Sandbox — safe to experiment.",
        "effects": ["film_grain"] if mode == "effect_only" else [],
        "transition": None,
        "text_graphic": item.get("text_graphic"),
        "text_graphic_layer": None,
        "background_color": "#000000",
        "sticker_overlay_enabled": True,
        "sticker_overlay_size": "medium",
        "title_overlay_enabled": True,
        "queries": default_queries(item),
        "completed_at": None,
        "updated_at": NOW,
    }


def asset_manifest(item: dict) -> dict:
    mode = item.get("visual_mode", "historical")
    is_text = mode == "text_graphic"
    is_effect = mode == "effect_only"
    if is_effect:
        targets = [
            {
                "slot": "black_plate",
                "description": "No source image — VO + effects on black",
                "status": "needed",
            }
        ]
    elif is_text:
        tg = item.get("text_graphic") or {}
        targets = [
            {
                "slot": "generated",
                "description": f"Text graphic: {tg.get('type', 'transcription')}",
                "status": "needed",
            }
        ]
    else:
        targets = [
            {
                "slot": "primary",
                "description": item.get("editorial_intent", ""),
                "status": "needed",
            }
        ]
    return {
        "version": 1,
        "id": item["id"],
        "cue": item["cue"],
        "t_start": item["t_start"],
        "t_end": item["t_end"],
        "duration_sec": item["duration_sec"],
        "spoken": item.get("spoken", ""),
        "visual_mode": mode,
        "expected_media_type": "generated" if is_text else item.get("media_type", "photo"),
        "editorial_intent": item.get("editorial_intent", ""),
        "situation": item.get("situation", ""),
        "people": item.get("people", []),
        "date_from": item.get("date_from", ""),
        "date_to": item.get("date_to", ""),
        "location": item.get("location", ""),
        "search_queries": item.get("search_queries", []),
        "avoid": item.get("avoid", []),
        "artifact": item.get("artifact"),
        "text_graphic": item.get("text_graphic"),
        "text_graphic_layer": None,
        "targets": targets,
        "effects": [],
        "transition": None,
        "background_color": "#000000",
        "requires_media_files": not is_text and not is_effect,
        "acquired_files": [],
        "source_media_search": MANIFEST_REL,
        "updated_at": NOW,
    }


def words_for_spoken(spoken: str, t_start: float, t_end: float) -> list:
    tokens = spoken.split()
    if not tokens:
        return []
    dur = max(t_end - t_start, 0.1)
    step = dur / len(tokens)
    out = []
    for i, tok in enumerate(tokens):
        ws = round(t_start + i * step, 3)
        we = round(t_start + (i + 1) * step - 0.02, 3)
        out.append({"word": tok, "start": ws, "end": max(we, ws + 0.05)})
    return out


def write_transcript_words(manifest: dict) -> None:
    words = []
    for item in manifest["items"]:
        spoken = (item.get("spoken") or "").strip()
        if not spoken:
            continue
        words.extend(words_for_spoken(spoken, item["t_start"], item["t_end"]))
    out = EPISODE / "transcript" / "sandbox.json"
    out.write_text(json.dumps({"words": words}, indent=2) + "\n", encoding="utf-8")


def write_acquisition_rollup(manifest: dict) -> None:
    items = {it["id"]: item_acquisition(it) for it in manifest["items"]}
    doc = {
        "version": 1,
        "source_manifest": MANIFEST_REL,
        "episode": manifest["episode"],
        "created_at": NOW,
        "updated_at": NOW,
        "item_count": len(items),
        "completed_count": 0,
        "items": items,
    }
    path = EPISODE / "timeline" / "media_acquisition.json"
    path.write_text(json.dumps(doc, indent=2) + "\n", encoding="utf-8")


def bootstrap_media_folders(manifest: dict) -> None:
    MEDIA_ROOT.mkdir(parents=True, exist_ok=True)
    project = {
        "version": 1,
        "project": "000_Sandbox",
        "source_media_search": MANIFEST_REL,
        "item_count": len(manifest["items"]),
        "created_at": NOW,
        "updated_at": NOW,
    }
    (MEDIA_ROOT / "project.json").write_text(
        json.dumps(project, indent=2) + "\n", encoding="utf-8"
    )

    for item in manifest["items"]:
        item_id = item["id"]
        item_dir = MEDIA_ROOT / item_id
        acq_dir = item_dir / "acquired"
        acq_dir.mkdir(parents=True, exist_ok=True)
        gitkeep = acq_dir / ".gitkeep"
        if not gitkeep.exists():
            gitkeep.write_text("", encoding="utf-8")

        am_path = item_dir / "asset_manifest.json"
        if not am_path.exists():
            am_path.write_text(
                json.dumps(asset_manifest(item), indent=2) + "\n", encoding="utf-8"
            )

        acq_path = item_dir / "acquisition.json"
        if not acq_path.exists():
            acq_path.write_text(
                json.dumps(item_acquisition(item), indent=2) + "\n", encoding="utf-8"
            )


def main() -> None:
    if not MANIFEST.exists():
        raise SystemExit(f"Missing {MANIFEST}")
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    write_transcript_words(manifest)
    write_acquisition_rollup(manifest)
    bootstrap_media_folders(manifest)
    print(f"Sandbox ready: {len(manifest['items'])} cues")
    print(f"  manifest: {MANIFEST_REL}")
    print("  Load in media_tool: @episode 000")


if __name__ == "__main__":
    main()
