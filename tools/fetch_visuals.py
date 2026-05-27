#!/usr/bin/env python3
"""
Download photos/videos for each slot in visual_manifest.json.

Photo providers:
  - commons — Wikimedia Commons (historical / editorial files; license in credits)
  - unsplash — https://unsplash.com/developers
  - pexels — https://www.pexels.com/api/
  - local — file you placed under the episode folder (see local_path)
  - placeholder — copy shared stub from manifest "placeholders" (no API keys)

Video: pexels by default, or provider "local" / "placeholder" (.mp4 / .mov).

Per-slot: set "provider": "local" and "local_path": "media/manual/myphoto.jpg"
(paths are relative to the folder that contains visual_manifest.json; must stay
inside that folder).

Optional "recommended_source" on any slot (llm, wikimedia_commons, pexels,
unsplash, local) is advisory only — copied to credits.json for the editor; it
does not change which provider runs unless you set "provider" accordingly.

Env:
  PEXELS_API_KEY        — required for video and photo slots using pexels
  UNSPLASH_ACCESS_KEY   — required for photo slots using unsplash
  WIKIMEDIA_CONTACT     — optional but recommended; appended to User-Agent for Commons
                          (see https://meta.wikimedia.org/wiki/User-Agent_policy )

We do not scrape Google Images: no rights metadata, violates Google ToS for bulk
fetching, and it does not grant you a license to the photos.

Usage (from repo root):
  export PEXELS_API_KEY=...
  export UNSPLASH_ACCESS_KEY=...   # if you use unsplash slots
  export WIKIMEDIA_CONTACT='https://your-site.example/contact'
  python3 tools/fetch_visuals.py 001_WhoWroteBackInBlack/visual/visual_manifest.json
"""

from __future__ import annotations

import argparse
import json
import os
import random
import shutil
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


def _wikimedia_user_agent() -> str:
    contact = os.environ.get("WIKIMEDIA_CONTACT", "").strip()
    if contact:
        return f"UnconventionalThoughtVisuals/1.0 ({contact})"
    return (
        "UnconventionalThoughtVisuals/1.0 "
        "(local tooling; set WIKIMEDIA_CONTACT per https://meta.wikimedia.org/wiki/User-Agent_policy)"
    )


def _pexels_headers() -> dict:
    key = os.environ.get("PEXELS_API_KEY", "").strip()
    if not key:
        raise RuntimeError("PEXELS_API_KEY is not set (required for video, and for photo slots using pexels).")
    return {"Authorization": key}


def _unsplash_headers() -> dict:
    key = os.environ.get("UNSPLASH_ACCESS_KEY", "").strip()
    if not key:
        raise RuntimeError("UNSPLASH_ACCESS_KEY is not set (required for photo slots using unsplash).")
    return {"Authorization": f"Client-ID {key}"}


def _get_json(url: str, headers: dict) -> dict:
    req = urllib.request.Request(url, headers=headers, method="GET")
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _download(url: str, dest: Path, headers: dict | None = None) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    h = dict(headers or {})
    req = urllib.request.Request(url, headers=h, method="GET")
    with urllib.request.urlopen(req, timeout=120) as resp:
        dest.write_bytes(resp.read())


def _flatten_extmetadata(raw: dict) -> dict:
    out: dict[str, str] = {}
    for k, v in (raw or {}).items():
        if isinstance(v, dict) and "value" in v:
            val = v.get("value")
            if val is not None:
                out[k] = str(val)
        elif v is not None:
            out[k] = str(v)
    return out


def _mime_to_ext(mime: str) -> str:
    m = (mime or "").lower().split(";")[0].strip()
    if m == "image/jpeg":
        return "jpg"
    if m == "image/png":
        return "png"
    if m == "image/webp":
        return "webp"
    raise ValueError(f"unsupported image mime: {mime}")


def _commons_page_url(title: str) -> str:
    return "https://commons.wikimedia.org/w/index.php?" + urllib.parse.urlencode({"title": title})


def _pick_commons_image(query: str) -> tuple[str, str, dict]:
    """Return (download_url, file_extension_without_dot, meta)."""
    q = urllib.parse.quote_plus(query)
    api = (
        "https://commons.wikimedia.org/w/api.php"
        "?action=query&format=json&formatversion=2"
        f"&generator=search&gsrsearch={q}&gsrnamespace=6&gsrlimit=24"
        "&prop=imageinfo&iiprop=url|extmetadata|mime|thumburl"
        "&iiurlwidth=1920"
    )
    ua = {"User-Agent": _wikimedia_user_agent()}
    payload = _get_json(api, ua)
    pages = (payload.get("query") or {}).get("pages") or []
    candidates: list[tuple[str, str, dict, str]] = []
    for page in pages:
        title = page.get("title") or ""
        infos = page.get("imageinfo") or []
        if not title.startswith("File:") or not infos:
            continue
        info = infos[0]
        mime = info.get("mime") or ""
        if mime not in ("image/jpeg", "image/png", "image/webp"):
            continue
        url = info.get("thumburl") or info.get("url")
        if not url:
            continue
        ext = _mime_to_ext(mime)
        flat = _flatten_extmetadata(info.get("extmetadata") or {})
        meta = {
            "provider": "commons",
            "commons_title": title,
            "commons_page_url": _commons_page_url(title),
            "license": flat.get("LicenseShortName") or flat.get("UsageTerms"),
            "credit": flat.get("Credit") or flat.get("Attribution"),
            "artist": flat.get("Artist"),
            "usage_terms": flat.get("UsageTerms"),
            "attribution_required": flat.get("AttributionRequired"),
        }
        candidates.append((url, ext, meta, title))

    if not candidates:
        raise ValueError("no suitable Commons images (jpeg/png/webp) for this query")

    url, ext, meta, _title = random.choice(candidates[:8])
    return url, ext, meta


def _pick_pexels_photo_url(payload: dict) -> tuple[str, dict]:
    photos = payload.get("photos") or []
    if not photos:
        raise ValueError("no photos in response")
    p = random.choice(photos[:5])
    src = p.get("src") or {}
    url = src.get("large2x") or src.get("large") or src.get("original")
    if not url:
        raise ValueError("photo missing src url")
    meta = {
        "provider": "pexels",
        "photographer": p.get("photographer"),
        "photographer_url": p.get("photographer_url"),
        "pexels_photo_url": p.get("url"),
        "id": p.get("id"),
    }
    return url, meta


def _pick_unsplash_photo(payload: dict, headers: dict, register_download: bool) -> tuple[str, dict]:
    results = payload.get("results") or []
    if not results:
        raise ValueError("no photos in response")
    p = random.choice(results[:5])
    links = p.get("links") or {}
    download_location = links.get("download_location")
    if not download_location:
        raise ValueError("unsplash photo missing download_location")
    if register_download:
        dl_req = urllib.request.Request(download_location, headers=headers, method="GET")
        with urllib.request.urlopen(dl_req, timeout=60):
            pass
    urls = p.get("urls") or {}
    url = urls.get("full") or urls.get("regular")
    if not url:
        raise ValueError("unsplash photo missing urls")
    user = p.get("user") or {}
    meta = {
        "provider": "unsplash",
        "photographer": user.get("name"),
        "photographer_url": (user.get("links") or {}).get("html"),
        "unsplash_photo_html": links.get("html"),
        "id": p.get("id"),
    }
    return url, meta


def _pick_video_url(payload: dict) -> tuple[str, dict]:
    videos = payload.get("videos") or []
    if not videos:
        raise ValueError("no videos in response")
    v = random.choice(videos[:5])
    files = v.get("video_files") or []
    if not files:
        raise ValueError("video missing files")

    def score(f: dict) -> tuple[int, int]:
        w = f.get("width") or 0
        qual = f.get("quality") or ""
        qrank = {"hd": 3, "sd": 2, "hls": 1}.get(qual, 0)
        dist = abs(w - 1280)
        return (-qrank, dist)

    best = sorted(files, key=score)[0]
    url = best.get("link")
    if not url:
        raise ValueError("video file missing link")
    meta = {
        "provider": "pexels",
        "user": v.get("user", {}).get("name"),
        "user_url": v.get("user", {}).get("url"),
        "pexels_video_url": v.get("url"),
        "id": v.get("id"),
        "quality": best.get("quality"),
        "width": best.get("width"),
    }
    return url, meta


def _photo_provider(slot: dict, defaults: dict) -> str:
    if slot.get("provider"):
        return str(slot["provider"]).lower()
    return str(defaults.get("photo", {}).get("provider", "pexels")).lower()


def _episode_root(manifest_path: Path, data: dict) -> Path:
    """Episode folder: manifest dir + episode_root (default parent of visual/)."""
    rel = data.get("episode_root", "..")
    return (manifest_path.parent / rel).resolve()


def _resolve_placeholder_slot(slot: dict, episode: Path, data: dict, media: str) -> tuple[Path, str, dict]:
    """Copy episode-level placeholder image or video into media/."""
    ph = data.get("placeholders") or {}
    if media == "video":
        rel = (ph.get("video_path") or "media/manual/PLACEHOLDER.mp4").strip()
    else:
        rel = (ph.get("photo_path") or "media/manual/PLACEHOLDER.jpg").strip()
    src = (episode / rel).resolve()
    episode_r = episode.resolve()
    try:
        src.relative_to(episode_r)
    except ValueError:
        raise ValueError(f"placeholder path must be inside episode folder: {rel}") from None
    if not src.is_file():
        raise ValueError(f"placeholder file missing: {src} (create it or fix placeholders in manifest)")
    suf = src.suffix.lower().lstrip(".")
    if suf == "jpeg":
        suf = "jpg"
    meta: dict = {"provider": "placeholder", "placeholder_source": rel.replace("\\", "/")}
    return src, suf, meta


def _resolve_local_slot(slot: dict, episode: Path) -> tuple[Path, str, dict]:
    """Validate local file; return (source_path, extension_without_dot, meta)."""
    raw = (slot.get("local_path") or slot.get("path") or "").strip()
    if not raw:
        raise ValueError('local provider requires "local_path" (relative to episode folder)')
    src = (episode / raw).resolve()
    episode_r = episode.resolve()
    try:
        src.relative_to(episode_r)
    except ValueError:
        raise ValueError(f"local_path must be inside episode folder: {raw}") from None
    if not src.is_file():
        raise ValueError(f"local file not found: {src}")
    suf = src.suffix.lower().lstrip(".")
    if suf == "jpeg":
        suf = "jpg"
    allowed_img = {"jpg", "png", "webp"}
    allowed_vid = {"mp4", "mov"}
    media = slot.get("media", "photo")
    if media == "video":
        if suf not in allowed_vid:
            raise ValueError(f"local video: use .mp4 or .mov, got .{suf}")
    else:
        if suf not in allowed_img:
            raise ValueError(f"local photo: use .jpg .png .webp, got .{suf}")
    meta: dict = {"provider": "local", "local_source": raw.replace("\\", "/")}
    if slot.get("credit_note"):
        meta["credit_note"] = slot["credit_note"]
    return src, suf, meta


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("manifest", type=Path, help="Path to visual_manifest.json")
    ap.add_argument("--dry-run", action="store_true", help="Search only; do not download")
    args = ap.parse_args()

    manifest_path = args.manifest.resolve()
    if not manifest_path.is_file():
        print(f"Manifest not found: {manifest_path}", file=sys.stderr)
        sys.exit(1)

    data = json.loads(manifest_path.read_text(encoding="utf-8"))
    episode = _episode_root(manifest_path, data)
    voice_path = episode / data.get("voice_json", "transcript/who_wrote_back_in_black.json")
    out_dir = episode / data.get("output_dir", "media/fetch")
    slots = data.get("slots") or []
    defaults = data.get("defaults") or {}

    if voice_path.is_file():
        voice = json.loads(voice_path.read_text(encoding="utf-8"))
        dur = voice.get("duration_seconds")
        print(f"Voice timing: {dur}s ({voice_path.name})")
    else:
        print(f"Note: voice_json missing at {voice_path}", file=sys.stderr)

    pexels_h: dict | None = None
    unsplash_h: dict | None = None

    def pexels() -> dict:
        nonlocal pexels_h
        if pexels_h is None:
            pexels_h = _pexels_headers()
        return pexels_h

    def unsplash() -> dict:
        nonlocal unsplash_h
        if unsplash_h is None:
            unsplash_h = _unsplash_headers()
        return unsplash_h

    commons_dl_headers = {"User-Agent": _wikimedia_user_agent()}
    credits: list[dict] = []

    def _slot_label(slot: dict) -> dict:
        lab = slot.get("label")
        return {"label": lab} if lab else {}

    def _slot_recommended_source(slot: dict) -> dict:
        rs = slot.get("recommended_source")
        return {"recommended_source": rs} if rs else {}

    for slot in slots:
        sid = slot["id"]
        media = slot.get("media", "photo")
        query = slot.get("query", "")
        t0 = slot.get("t_start")
        t1 = slot.get("t_end")
        q = urllib.parse.quote_plus(query)

        try:
            asset_url: str | None = None

            if str(slot.get("provider", "")).lower() == "placeholder":
                src_path, ext, meta = _resolve_placeholder_slot(slot, episode, data, media)
                dest = out_dir / f"{sid}.{ext}"
                entry = {
                    "slot": sid,
                    "t_start": t0,
                    "t_end": t1,
                    "query": query,
                    "media": media,
                    "file": str(dest.relative_to(episode)),
                    **_slot_label(slot),
                    **_slot_recommended_source(slot),
                    **meta,
                }
                if args.dry_run:
                    print(f"[dry-run] {sid} {media} placeholder {t0}-{t1} <- {meta['placeholder_source']}")
                else:
                    print(f"Copying {sid} ({media}, placeholder stub) …")
                    out_dir.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(src_path, dest)
                    print(f"  -> {dest}")
                credits.append(entry)
                continue

            if str(slot.get("provider", "")).lower() == "local":
                src_path, ext, meta = _resolve_local_slot(slot, episode)
                dest = out_dir / f"{sid}.{ext}"
                entry = {
                    "slot": sid,
                    "t_start": t0,
                    "t_end": t1,
                    "query": query,
                    "media": media,
                    "file": str(dest.relative_to(episode)),
                    **_slot_label(slot),
                    **_slot_recommended_source(slot),
                    **meta,
                }
                if args.dry_run:
                    print(f"[dry-run] {sid} {media} local {t0}-{t1} <- {meta['local_source']}")
                else:
                    print(f"Copying {sid} ({media}, local) …")
                    out_dir.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(src_path, dest)
                    print(f"  -> {dest}")
                credits.append(entry)
                continue

            if media == "video":
                url = f"https://api.pexels.com/videos/search?query={q}&per_page=15"
                payload = _get_json(url, pexels())
                asset_url, meta = _pick_video_url(payload)
                ext = "mp4"
            else:
                prov = _photo_provider(slot, defaults)
                if prov == "commons":
                    time.sleep(0.4)
                    asset_url, ext, meta = _pick_commons_image(query)
                elif prov == "unsplash":
                    url = (
                        f"https://api.unsplash.com/search/photos"
                        f"?query={q}&per_page=15&orientation=landscape"
                    )
                    payload = _get_json(url, unsplash())
                    asset_url, meta = _pick_unsplash_photo(
                        payload, unsplash(), register_download=not args.dry_run
                    )
                    ext = "jpg"
                elif prov == "pexels":
                    url = f"https://api.pexels.com/v1/search?query={q}&per_page=15"
                    payload = _get_json(url, pexels())
                    asset_url, meta = _pick_pexels_photo_url(payload)
                    ext = "jpg"
                else:
                    raise ValueError(f"unknown photo provider: {prov}")

            dest = out_dir / f"{sid}.{ext}"
            entry = {
                "slot": sid,
                "t_start": t0,
                "t_end": t1,
                "query": query,
                "media": media,
                "file": str(dest.relative_to(episode)),
                **_slot_label(slot),
                **_slot_recommended_source(slot),
                **meta,
            }

            if args.dry_run:
                tail = (asset_url or "")[:80]
                print(f"[dry-run] {sid} {media} {entry.get('provider')} {t0}-{t1} -> {tail}...")
            else:
                print(f"Downloading {sid} ({media}, {entry.get('provider')}) …")
                dl_h = commons_dl_headers if entry.get("provider") == "commons" else None
                assert asset_url is not None
                _download(asset_url, dest, headers=dl_h)
                print(f"  -> {dest}")

            credits.append(entry)
        except (urllib.error.HTTPError, urllib.error.URLError, ValueError, KeyError, RuntimeError) as e:
            print(f"ERROR {sid}: {e}", file=sys.stderr)
            if isinstance(e, urllib.error.HTTPError):
                try:
                    print(e.read().decode("utf-8")[:500], file=sys.stderr)
                except Exception:
                    pass

    if not args.dry_run and credits:
        out_dir.mkdir(parents=True, exist_ok=True)
        (out_dir / "credits.json").write_text(
            json.dumps({"slots": credits}, indent=2),
            encoding="utf-8",
        )
        print(f"Wrote {out_dir / 'credits.json'}")
    elif args.dry_run:
        print("--dry-run: no files written.")


if __name__ == "__main__":
    main()
