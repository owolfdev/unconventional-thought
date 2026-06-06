#!/usr/bin/env python3
"""
Copy episode 001 per-cue acquired/ media into media_tool/public/media/_library/.

Leaves original acquired/ files in place. Rebuilds index.json when done.

Usage (repo root):
  python3 tools/migrate_ep001_library.py
  python3 tools/migrate_ep001_library.py --dry-run
  python3 tools/migrate_ep001_library.py --episode 001_WhoWroteBackInBlack
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
MEDIA_TOOL = REPO / "media_tool"
MEDIA_PUBLIC = MEDIA_TOOL / "public" / "media"
LIBRARY_ROOT = MEDIA_PUBLIC / "_library"
ASSETS_ROOT = LIBRARY_ROOT / "assets"
INDEX_PATH = LIBRARY_ROOT / "index.json"

DEFAULT_EPISODE = "001_WhoWroteBackInBlack"

VIDEO_EXT = {".mp4", ".mov", ".webm", ".m4v", ".mkv"}
SKIP_NAMES = {".gitkeep", ".ds_store"}

UGLY_PATTERNS = [
    re.compile(r"^download-[a-f0-9]{8,}\.[a-z0-9]+$", re.I),
    re.compile(r"^upload-\d+\.[a-z0-9]+$", re.I),
    re.compile(r"^[A-Za-z0-9_-]{11}\.(mp4|webm|mkv)$", re.I),
    re.compile(r"^giphy-[a-z0-9]+\.gif$", re.I),
    re.compile(r"^sticker-[a-f0-9-]+\.png$", re.I),
    re.compile(r"^title-[a-f0-9-]+\.png$", re.I),
]


def iso_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def content_hash_id(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()[:16]


def slugify(text: str, max_len: int = 80) -> str:
    slug = re.sub(r"[^\w\s-]", "", text.lower()).strip()
    slug = re.sub(r"[\s_]+", "-", slug)
    slug = re.sub(r"-+", "-", slug).strip("-")
    return (slug or "asset")[:max_len]


def is_ugly_filename(name: str) -> bool:
    base = Path(name).name
    if len(base) <= 4:
        return True
    return any(p.match(base) for p in UGLY_PATTERNS)


def sanitize_filename(name: str) -> str:
    base = Path(name).name
    base = re.sub(r"[^\w.\-()+ ]", "_", base)
    base = re.sub(r"\s+", " ", base).strip()[:160]
    return base if base and base not in {".", ".."} else "asset.bin"


def suggest_filename(original: str, *, title: str = "", query: str = "") -> str:
    ext = Path(original).suffix or ".bin"
    if not is_ugly_filename(original):
        return sanitize_filename(original)
    stem = slugify(title) or slugify(query) or slugify(Path(original).stem)
    return f"{stem}{ext.lower()}"


def unique_filename_in_dir(directory: Path, filename: str) -> str:
    ext = Path(filename).suffix
    stem = Path(filename).stem or "asset"
    candidate = filename
    n = 1
    while (directory / candidate).exists():
        candidate = f"{stem}-{n}{ext}"
        n += 1
    return candidate


def media_type(filename: str) -> str:
    return "video" if Path(filename).suffix.lower() in VIDEO_EXT else "photo"


def infer_kind(filename: str) -> str:
    lower = filename.lower()
    if lower.startswith(("sticker-", "giphy-", "title-")):
        return "overlay"
    return "archive"


def build_search_text(meta: dict) -> str:
    parts = [
        meta.get("filename", ""),
        meta.get("original_filename", ""),
        *meta.get("tags", []),
        meta.get("manual_notes", ""),
    ]
    return " ".join(p.strip() for p in parts if p and str(p).strip()).lower()


def append_usage(usages: list, next_usage: dict) -> list:
    for i, u in enumerate(usages):
        if u.get("episode_id") == next_usage.get("episode_id") and u.get(
            "cue_id"
        ) == next_usage.get("cue_id"):
            usages[i] = next_usage
            return usages
    return [*usages, next_usage]


def derive_tags(manifest: dict) -> list[str]:
    tags: set[str] = set()
    for p in manifest.get("people") or []:
        name = (p.get("name") or "").strip()
        if name:
            tags.add(name.lower())
    artifact = manifest.get("artifact") or {}
    obj = (artifact.get("object") or "").strip()
    if obj:
        tags.add(obj.lower())
    return sorted(tags)


def usage_from_manifest(episode_id: str, manifest: dict) -> dict:
    return {
        "episode_id": episode_id,
        "cue_id": manifest.get("id", ""),
        "spoken": manifest.get("spoken") or "",
        "search_queries": manifest.get("search_queries") or [],
        "people": manifest.get("people") or [],
        "situation": manifest.get("situation") or "",
        "editorial_intent": manifest.get("editorial_intent") or "",
        "attached_at": iso_now(),
    }


def library_public_url(asset_id: str, filename: str) -> str:
    from urllib.parse import quote

    return f"/media/_library/assets/{asset_id}/{quote(filename)}"


def meta_to_index_entry(meta: dict) -> dict:
    return {
        "id": meta["id"],
        "filename": meta["filename"],
        "kind": meta["kind"],
        "media_type": meta["media_type"],
        "thumbnail_url": library_public_url(meta["id"], meta["filename"]),
        "public_url": library_public_url(meta["id"], meta["filename"]),
        "tags": meta.get("tags", []),
        "search_text": meta.get("search_text", ""),
        "usage_count": len(meta.get("usages", [])),
        "archived": meta.get("archived", False),
        "created_at": meta["created_at"],
        "updated_at": meta["updated_at"],
    }


def rebuild_index() -> dict:
    assets: list[dict] = []
    if ASSETS_ROOT.exists():
        for asset_dir in sorted(ASSETS_ROOT.iterdir()):
            if not asset_dir.is_dir():
                continue
            meta_path = asset_dir / "meta.json"
            if not meta_path.exists():
                continue
            meta = read_json(meta_path)
            assets.append(meta_to_index_entry(meta))
    assets.sort(key=lambda a: a.get("updated_at", ""), reverse=True)
    index = {
        "version": 1,
        "updated_at": iso_now(),
        "asset_count": len(assets),
        "assets": assets,
    }
    write_json(INDEX_PATH, index)
    return index


def ingest_file(
    source: Path,
    episode_id: str,
    manifest: dict,
    *,
    dry_run: bool,
) -> tuple[str, bool]:
    """Returns (status, is_dedup) where status is copied|dedup|skipped."""
    name = source.name
    if name.lower() in SKIP_NAMES or name.startswith("."):
        return "skipped", False

    data = source.read_bytes()
    asset_id = content_hash_id(data)
    asset_dir = ASSETS_ROOT / asset_id
    meta_path = asset_dir / "meta.json"
    usage = usage_from_manifest(episode_id, manifest)
    kind = infer_kind(name)
    now = iso_now()
    query_hint = (manifest.get("search_queries") or [None])[0] or manifest.get(
        "spoken", ""
    )

    if meta_path.exists():
        if dry_run:
            return "dedup", True
        meta = read_json(meta_path)
        meta["usages"] = append_usage(meta.get("usages", []), usage)
        meta["tags"] = sorted(set(meta.get("tags", [])) | set(derive_tags(manifest)))
        meta["updated_at"] = now
        meta["search_text"] = build_search_text(meta)
        write_json(meta_path, meta)
        return "dedup", True

    filename = suggest_filename(
        name,
        title=manifest.get("spoken") or "",
        query=query_hint or "",
    )
    if not dry_run:
        asset_dir.mkdir(parents=True, exist_ok=True)
        filename = unique_filename_in_dir(asset_dir, filename)
        shutil.copy2(source, asset_dir / filename)
        meta = {
            "version": 1,
            "id": asset_id,
            "filename": filename,
            "original_filename": name,
            "kind": kind,
            "media_type": media_type(filename),
            "source_url": None,
            "source_engine": "ep001_migration",
            "license": "migrated from episode 001 acquired/ — verify rights",
            "tags": derive_tags(manifest),
            "manual_notes": f"Migrated from {episode_id}/{manifest.get('id')}/acquired/",
            "usages": [usage],
            "archived": False,
            "created_at": now,
            "updated_at": now,
            "search_text": "",
        }
        meta["search_text"] = build_search_text(meta)
        write_json(meta_path, meta)
    return "copied", False


def migrate_episode(episode_id: str, *, dry_run: bool) -> int:
    episode_media = MEDIA_PUBLIC / episode_id
    if not episode_media.is_dir():
        print(f"Episode media folder not found: {episode_media}", file=sys.stderr)
        return 1

    stats = {"copied": 0, "dedup": 0, "skipped": 0, "files": 0, "cues": 0}

    for cue_dir in sorted(episode_media.iterdir()):
        if not cue_dir.is_dir() or not cue_dir.name.startswith("m"):
            continue
        acquired = cue_dir / "acquired"
        if not acquired.is_dir():
            continue
        manifest_path = cue_dir / "asset_manifest.json"
        if not manifest_path.is_file():
            print(f"  skip {cue_dir.name}: no asset_manifest.json", file=sys.stderr)
            continue
        manifest = read_json(manifest_path)
        stats["cues"] += 1

        for source in sorted(acquired.iterdir()):
            if not source.is_file():
                continue
            stats["files"] += 1
            status, _ = ingest_file(
                source, episode_id, manifest, dry_run=dry_run
            )
            stats[status] += 1

    if not dry_run:
        index = rebuild_index()
        print(f"\nLibrary index: {index['asset_count']} assets")
    else:
        print("\n(dry-run — no files written)")

    print(
        f"\nEpisode {episode_id}: {stats['cues']} cues, {stats['files']} files scanned"
    )
    print(
        f"  copied: {stats['copied']}  deduplicated: {stats['dedup']}  skipped: {stats['skipped']}"
    )
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Migrate episode acquired/ files into media_tool _library/"
    )
    parser.add_argument(
        "--episode",
        default=DEFAULT_EPISODE,
        help=f"Episode media folder name (default: {DEFAULT_EPISODE})",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Report actions without copying or writing meta",
    )
    args = parser.parse_args()

    print(f"Migrating {args.episode} → {LIBRARY_ROOT}")
    if args.dry_run:
        print("DRY RUN\n")
    return migrate_episode(args.episode, dry_run=args.dry_run)


if __name__ == "__main__":
    raise SystemExit(main())
