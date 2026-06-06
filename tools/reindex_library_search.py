#!/usr/bin/env python3
"""Recompute _library search_text from tags/filename/notes only (not usages)."""

from __future__ import annotations

import json
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
LIBRARY = REPO / "media_tool" / "public" / "media" / "_library"
ASSETS = LIBRARY / "assets"


def build_search_text(meta: dict) -> str:
    parts = [
        meta.get("filename", ""),
        meta.get("original_filename", ""),
        *meta.get("tags", []),
        meta.get("manual_notes", ""),
    ]
    return " ".join(p.strip() for p in parts if isinstance(p, str) and p.strip()).lower()


def main() -> None:
    if not ASSETS.is_dir():
        raise SystemExit(f"Library assets not found: {ASSETS}")

    updated = 0
    entries = []
    for asset_dir in sorted(ASSETS.iterdir()):
        if not asset_dir.is_dir():
            continue
        meta_path = asset_dir / "meta.json"
        if not meta_path.is_file():
            continue
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        next_search = build_search_text(meta)
        if meta.get("search_text") != next_search:
            meta["search_text"] = next_search
            meta_path.write_text(
                json.dumps(meta, indent=2, ensure_ascii=False) + "\n",
                encoding="utf-8",
            )
            updated += 1
        entries.append(
            {
                "id": meta["id"],
                "filename": meta["filename"],
                "original_filename": meta.get("original_filename", ""),
                "kind": meta["kind"],
                "media_type": meta["media_type"],
                "thumbnail_url": f"/media/_library/assets/{meta['id']}/{meta['filename']}",
                "public_url": f"/media/_library/assets/{meta['id']}/{meta['filename']}",
                "tags": meta.get("tags", []),
                "manual_notes": meta.get("manual_notes", ""),
                "search_text": meta["search_text"],
                "usage_count": len(meta.get("usages", [])),
                "archived": meta.get("archived", False),
                "created_at": meta.get("created_at", ""),
                "updated_at": meta.get("updated_at", ""),
            }
        )

    entries.sort(key=lambda e: e["updated_at"], reverse=True)
    index = {
        "version": 1,
        "updated_at": entries[0]["updated_at"] if entries else "",
        "asset_count": len(entries),
        "assets": entries,
    }
    index_path = LIBRARY / "index.json"
    index_path.write_text(
        json.dumps(index, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"Reindexed {len(entries)} assets ({updated} search_text updates)")


if __name__ == "__main__":
    main()
