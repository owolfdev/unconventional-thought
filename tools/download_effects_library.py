#!/usr/bin/env python3
"""
Download YouTube overlay sources listed in episode effects/*.md into
media_tool/public/media/_effects/<category>/<video_id>.mp4

Uses yt-dlp with the same constraints as media_tool (max 1080p, mp4, no playlist).

  python3 tools/download_effects_library.py
  python3 tools/download_effects_library.py --dry-run
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
EFFECTS_DOCS = REPO_ROOT / "001_WhoWroteBackInBlack" / "effects"
DEFAULT_OUT = REPO_ROOT / "media_tool" / "public" / "media" / "_effects"

URL_RE = re.compile(
    r"https?://(?:www\.)?(?:youtube\.com/watch\?[^\s]+|youtu\.be/[^\s]+)",
    re.I,
)


def slugify(label: str) -> str:
    s = label.strip().lower()
    s = re.sub(r"[^a-z0-9]+", "_", s)
    return s.strip("_") or "uncategorized"


def extract_urls(line: str) -> list[str]:
    return [m.group(0).rstrip(".,)") for m in URL_RE.finditer(line)]


def parse_markdown_sources(path: Path) -> list[dict[str, str]]:
    """Return {category, url, source_file} from effects-style markdown."""
    items: list[dict[str, str]] = []
    category = "uncategorized"
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line:
            continue
        urls = extract_urls(line)
        if urls:
            for url in urls:
                items.append(
                    {
                        "category": category,
                        "url": url,
                        "source_file": path.name,
                    }
                )
        elif not line.startswith("http"):
            category = slugify(line)
    return items


def collect_sources() -> list[dict[str, str]]:
    seen: set[str] = set()
    out: list[dict[str, str]] = []
    for md in sorted(EFFECTS_DOCS.glob("*.md")):
        for item in parse_markdown_sources(md):
            if item["url"] in seen:
                continue
            seen.add(item["url"])
            out.append(item)
    return out


def video_id_from_url(url: str) -> str | None:
    m = re.search(r"[?&]v=([a-zA-Z0-9_-]{11})", url)
    if m:
        return m.group(1)
    m = re.search(r"youtu\.be/([a-zA-Z0-9_-]{11})", url)
    return m.group(1) if m else None


def existing_for_id(out_dir: Path, vid: str) -> Path | None:
    for p in out_dir.rglob(f"{vid}.*"):
        if p.is_file() and p.suffix.lower() in {".mp4", ".webm", ".mkv", ".mov"}:
            return p
    return None


def cleanup_extra_streams(dest_dir: Path, keep: Path) -> None:
    """Remove leftover separate streams when merge/remux left extras."""
    vid = keep.stem.split(".")[0]
    for p in dest_dir.iterdir():
        if not p.is_file() or p == keep:
            continue
        if p.name.startswith(f"{vid}.") or p.name.startswith(vid):
            try:
                p.unlink()
            except OSError:
                pass


def run_yt_dlp(url: str, dest_dir: Path, dry_run: bool) -> Path | None:
    dest_dir.mkdir(parents=True, exist_ok=True)
    template = str(dest_dir / "%(id)s.%(ext)s")
    # Overlay clips are often silent — prefer a single video stream, remux to mp4.
    cmd = [
        "yt-dlp",
        "-f",
        "bestvideo[height<=1080]/best[height<=1080]",
        "--remux-video",
        "mp4",
        "-o",
        template,
        "--no-playlist",
        "--no-warnings",
        url,
    ]
    if dry_run:
        print("  would run:", " ".join(cmd))
        vid = video_id_from_url(url)
        return dest_dir / f"{vid}.mp4" if vid else None

    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        err = (proc.stderr or proc.stdout or "").strip()
        raise RuntimeError(err or f"yt-dlp exited {proc.returncode}")

    vid = video_id_from_url(url)
    if vid:
        hit = existing_for_id(dest_dir, vid)
        if hit:
            cleanup_extra_streams(dest_dir, hit)
            return hit
    files = [
        p
        for p in dest_dir.iterdir()
        if p.is_file() and not p.name.startswith(".")
    ]
    if not files:
        raise RuntimeError("yt-dlp finished but no output file found")
    best = max(files, key=lambda p: p.stat().st_mtime)
    cleanup_extra_streams(dest_dir, best)
    return best


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--out",
        type=Path,
        default=DEFAULT_OUT,
        help=f"Output root (default: {DEFAULT_OUT})",
    )
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if not EFFECTS_DOCS.is_dir():
        print(f"Effects docs not found: {EFFECTS_DOCS}", file=sys.stderr)
        return 1

    sources = collect_sources()
    if not sources:
        print("No YouTube URLs found in effects/*.md", file=sys.stderr)
        return 1

    if not args.dry_run:
        try:
            subprocess.run(
                ["yt-dlp", "--version"],
                capture_output=True,
                check=True,
            )
        except (subprocess.CalledProcessError, FileNotFoundError):
            print("yt-dlp not found. Install: brew install yt-dlp", file=sys.stderr)
            return 1

    args.out.mkdir(parents=True, exist_ok=True)
    manifest_entries: list[dict] = []
    ok, skipped, failed = 0, 0, 0

    print(f"{'[dry-run] ' if args.dry_run else ''}Downloading {len(sources)} videos → {args.out}\n")

    for i, item in enumerate(sources, 1):
        url = item["url"]
        category = item["category"]
        vid = video_id_from_url(url)
        dest_dir = args.out / category
        label = f"[{i}/{len(sources)}] {category} ({vid or '?'})"

        existing = existing_for_id(args.out, vid) if vid and not args.dry_run else None
        if existing:
            print(f"{label} — skip (exists): {existing.relative_to(args.out)}")
            manifest_entries.append(
                {**item, "video_id": vid, "file": str(existing.relative_to(args.out)), "status": "skipped"}
            )
            skipped += 1
            continue

        print(f"{label}")
        print(f"  {url}")
        try:
            path = run_yt_dlp(url, dest_dir, args.dry_run)
            rel = str(path.relative_to(args.out)) if path else None
            manifest_entries.append(
                {
                    **item,
                    "video_id": vid,
                    "file": rel,
                    "status": "dry_run" if args.dry_run else "downloaded",
                }
            )
            if not args.dry_run and path:
                print(f"  → {rel}")
            ok += 1
        except Exception as e:
            print(f"  FAILED: {e}", file=sys.stderr)
            manifest_entries.append(
                {**item, "video_id": vid, "file": None, "status": "failed", "error": str(e)}
            )
            failed += 1
        print()

    manifest = {
        "version": 1,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "output_dir": str(args.out),
        "source_docs": [p.name for p in sorted(EFFECTS_DOCS.glob("*.md"))],
        "entries": manifest_entries,
    }
    manifest_path = args.out / "manifest.json"
    if not args.dry_run:
        manifest_path.write_text(
            json.dumps(manifest, indent=2) + "\n",
            encoding="utf-8",
        )

    print(f"Done: {ok} ok, {skipped} skipped, {failed} failed")
    if not args.dry_run:
        print(f"Manifest: {manifest_path}")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
