#!/usr/bin/env python3
"""
Build Remotion timeline JSON from media_tool per-cue folders + media_search.json.

  python3 tools/build_remotion_timeline.py --episode 001_WhoWroteBackInBlack --max m140
  python3 tools/build_remotion_timeline.py --max m035
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import unquote

from episode_config import DEFAULT_EPISODE_ID, MEDIA_PUBLIC, episode_paths

REPO = Path(__file__).resolve().parents[1]
EFFECTS_ROOT = MEDIA_PUBLIC / "_effects"
LIBRARY_SLUG = "_library"

# Set by configure_episode() before build
EPISODE: Path
EPISODE_ID: str
MEDIA_ROOT: Path
REMOTION_PUBLIC: Path
MEDIA_SEARCH: Path
DEFAULT_AUDIO: Path
DEFAULT_OUT: Path
TRANSCRIPT_JSON: Path
PREVIEW_SETTINGS: Path
REMOTION_DIR: Path


def configure_episode(episode_id: str) -> None:
    global EPISODE, EPISODE_ID, MEDIA_ROOT, REMOTION_PUBLIC, MEDIA_SEARCH
    global DEFAULT_AUDIO, DEFAULT_OUT, TRANSCRIPT_JSON, PREVIEW_SETTINGS, REMOTION_DIR
    paths = episode_paths(episode_id)
    EPISODE_ID = episode_id
    EPISODE = paths["episode_dir"]
    MEDIA_ROOT = paths["media_root"]
    REMOTION_PUBLIC = paths["remotion_public"]
    MEDIA_SEARCH = paths["media_search"]
    DEFAULT_AUDIO = paths["audio_master"]
    DEFAULT_OUT = paths["timeline_out"]
    TRANSCRIPT_JSON = paths["transcript_json"]
    PREVIEW_SETTINGS = paths["preview_settings"]
    REMOTION_DIR = paths["remotion_dir"]

IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
VIDEO_EXT = {".mp4", ".mov", ".webm", ".m4v", ".mkv"}

TRIM_MARGIN_SEC = 10.0
DEFAULT_EFFECT_DURATION_SEC = 90.0
TRANSITION_WINDOW_SEC = 1.25

# Editorial timing overrides for specific beats.
SPECIAL_TIMING: dict[str, tuple[float, float]] = {
    # m009 "It's 1980" -> a bit earlier lead, then overlaps into next beat.
    "m009": (0.6, 1.6),
    # m022 Back in Black LP — 2s lead-in for spin; 1s tail (was 2s, overlapped m023).
    "m022": (2.0, 1.0),
    # m026 Brian Johnson — linger 2s into m027 (pair with m027 media delay).
    "m026": (0.0, 2.0),
    # m006 Bon Scott + typewriter — hold 2s after VO ends before next beat.
    "m006": (0.0, 2.0),
    # m016 type_graphic — start typewriter 1s before VO t_start.
    "m016": (1.0, 0.0),
    # m055 type_graphic — start typewriter 1s before VO.
    "m055": (1.0, 0.0),
    # m035 Bon Scott live — hold image 2s after VO (pair with m036 media delay).
    "m035": (0.0, 2.0),
    # m036 three-image sequence — start cue slightly early for more plate time.
    "m036": (0.5, 0.0),
    # m067 GIPHY sticker — hold 1s after VO for extra loop time.
    "m067": (0.0, 1.0),
    # m084 "Right?" — +1s before and after (VO is ~0.12s; GIPHY needs room).
    "m084": (1.0, 1.0),
    # m089 GIPHY — start 1s before VO so the GIF has runway.
    "m089": (1.0, 0.0),
}

# Incoming cue: delay only the *image* so the previous shot bleeds through.
SPECIAL_MEDIA_DELAY: dict[str, float] = {
    # m000 title card (2s) — hold m001 plate until title ends (m001 VO starts ~0.43s).
    "m001": 1.57,
    "m027": 2.0,
    # ~1s bleed from m035 tail; 2s pushed all 3 plates into the last ~1.5s of VO.
    "m036": 1.0,
}

# Scale contained / document media within the frame (1.0 = default).
SPECIAL_MEDIA_SCALE: dict[str, float] = {
    "m031": 0.75,
    # Portrait lyrics: fill-width + slight overscan (scroll trims scan margins).
    "m032": 1.12,
}

# Override auto fit when a cue must differ from effect-based rules.
SPECIAL_MEDIA_FIT: dict[str, str] = {
    # m032: portrait doc — span frame width (tall overflow clips, not side letterbox).
    "m032": "fill-width",
    # m093/m094: square LP covers — whole image, letterboxed (not cover crop).
    "m093": "contain",
    "m094": "contain",
}

# Per-cue motion tuning (tilt degrees, scroll range multiplier).
SPECIAL_MOTION: dict[str, dict[str, float]] = {
    "m032": {"tiltDeg": -5.5, "scrollSpeed": 0.48},
}

# Sticker/GIF overlay visible only for this many seconds from cue start.
SPECIAL_STICKER_HIDE_AFTER_SEC: dict[str, float] = {
    "m017": 1.0,
    "m026": 2.0,
}

# Motion on sticker/GIF layer only (shake, tremble — not plate zoom/tilt).
SPECIAL_STICKER_EFFECTS: dict[str, list[str]] = {
    "m050": ["shake"],
}

# Typewriter / text reveal speed multiplier (>1 = faster).
SPECIAL_TEXT_REVEAL_SPEED: dict[str, float] = {
    "m055": 3.0,
}

# Effect / transition IDs → folder under media/_effects
EFFECT_TO_CATEGORY: dict[str, str] = {
    "film_scratches": "scratches",
    "film_damage": "film_damage",
    "film_grain": "scratches",
    "floating_particles": "floating_particles",
    "paper_texture": "overlays",
    "crt_glow": "overlays",
}

TRANSITION_TO_CATEGORY: dict[str, str] = {
    "film_burn": "burns",
    "broken_film": "film_damage",
    "flame": "burns",
    "light_leak": "light_leaks",
    "paper_flash": "overlays",
}

EFFECT_OPACITY: dict[str, float] = {
    "film_scratches": 0.72,
    "film_damage": 0.58,
    "film_grain": 0.38,
    "floating_particles": 0.5,
    "paper_texture": 0.65,
    "crt_glow": 0.55,
}

TRANSITION_OPACITY: dict[str, float] = {
    "film_burn": 0.88,
    "broken_film": 0.75,
    "flame": 0.85,
    "light_leak": 0.8,
    "paper_flash": 0.9,
}

# Ken Burns / camera motion — not stock scratch/grain overlays.
MOTION_ONLY_EFFECTS = frozenset(
    {
        "slow_push_in",
        "slow_zoom_in",
        "slow_zoom_out",
        "slow_scroll_up",
        "slow_spin",
        "tilt_left",
        "tilt_right",
        "tremble",
        "shake",
    }
)

_effects_library: dict[str, list[tuple[Path, float]]] | None = None


def notes_still_plate(notes: str) -> bool:
    n = notes.lower()
    return bool(
        re.search(
            r"still\s+(image|photo|frame|shot)|no\s+(camera|push|zoom|ken)|"
            r"no\s+push|without\s+(camera|motion|movement)|frozen\s+frame",
            n,
        )
    )


def sticker_hide_after_sec(item_id: str, notes: str) -> float | None:
    if item_id in SPECIAL_STICKER_HIDE_AFTER_SEC:
        return SPECIAL_STICKER_HIDE_AFTER_SEC[item_id]
    if notes:
        m = re.search(
            r"hide\s+sticker\s+after\s+(\d+(?:\.\d+)?)\s*sec",
            notes,
            re.I,
        )
        if m:
            return float(m.group(1))
    return None


def sticker_effects_for_shot(item_id: str, notes: str) -> list[str]:
    if item_id in SPECIAL_STICKER_EFFECTS:
        return list(SPECIAL_STICKER_EFFECTS[item_id])
    if notes:
        if re.search(r"shake\s+sticker|sticker\s+shake", notes, re.I):
            return ["shake"]
        if re.search(r"tremble\s+sticker|sticker\s+tremble", notes, re.I):
            return ["tremble"]
    return []


def effects_respecting_notes(effects: list[str], notes: str) -> list[str]:
    if not notes_still_plate(notes):
        return effects
    return [e for e in effects if e not in MOTION_ONLY_EFFECTS]


def ensure_remotion_public_links() -> None:
    """Symlink media + audio into remotion/public for staticFile() during render."""
    REMOTION_PUBLIC.mkdir(parents=True, exist_ok=True)
    links: dict[str, Path] = {
        "media": MEDIA_PUBLIC,
    }
    audio_dir = EPISODE / "audio"
    if audio_dir.is_dir():
        links["audio"] = audio_dir
    for name, target in links.items():
        link = REMOTION_PUBLIC / name
        if link.is_symlink() and link.resolve() == target.resolve():
            continue
        if link.exists() or link.is_symlink():
            link.unlink()
        link.symlink_to(target, target_is_directory=True)
    # Drop stale audio symlink when episode has no audio/
    audio_link = REMOTION_PUBLIC / "audio"
    if "audio" not in links and (audio_link.exists() or audio_link.is_symlink()):
        audio_link.unlink()


def default_preview_settings() -> dict:
    return {
        "version": 1,
        "showCueOverlay": True,
        "showStickerOverlays": True,
        "updated_at": datetime.now(timezone.utc)
        .isoformat()
        .replace("+00:00", "Z"),
    }


def ensure_remotion_preview_settings() -> None:
    """Episode preview-settings → remotion/src/preview-settings.json for bundle import."""
    if not PREVIEW_SETTINGS.is_file():
        PREVIEW_SETTINGS.parent.mkdir(parents=True, exist_ok=True)
        PREVIEW_SETTINGS.write_text(
            json.dumps(default_preview_settings(), indent=2) + "\n",
            encoding="utf-8",
        )

    remotion_settings = REMOTION_DIR / "src" / "preview-settings.json"
    remotion_settings.parent.mkdir(parents=True, exist_ok=True)
    if remotion_settings.is_symlink() and remotion_settings.resolve() == PREVIEW_SETTINGS.resolve():
        return
    if remotion_settings.exists() or remotion_settings.is_symlink():
        remotion_settings.unlink()
    remotion_settings.symlink_to(PREVIEW_SETTINGS)


def rel_public(path: Path) -> str:
    """Path relative to remotion/public/ for staticFile()."""
    resolved = path.resolve()
    if resolved.is_relative_to(REMOTION_PUBLIC.resolve()):
        return str(resolved.relative_to(REMOTION_PUBLIC.resolve()))
    if resolved.is_relative_to(MEDIA_PUBLIC.resolve()):
        return str(Path("media") / resolved.relative_to(MEDIA_PUBLIC.resolve()))
    if resolved.is_relative_to((EPISODE / "audio").resolve()):
        return str(Path("audio") / resolved.relative_to((EPISODE / "audio").resolve()))
    return str(resolved.relative_to(REPO))


def parse_max_id(value: str) -> int:
    m = re.match(r"m(\d+)$", value.strip(), re.I)
    if not m:
        raise ValueError(f"Expected id like m035, got {value!r}")
    return int(m.group(1))


def media_kind(path: Path) -> str:
    ext = path.suffix.lower()
    if ext in IMAGE_EXT:
        return "image"
    if ext in VIDEO_EXT:
        return "video"
    return "other"


def stable_uniform(seed: str) -> float:
    digest = hashlib.sha256(seed.encode()).hexdigest()
    return int(digest[:8], 16) / 0xFFFFFFFF


def probe_duration_sec(path: Path) -> float:
    try:
        proc = subprocess.run(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                str(path),
            ],
            capture_output=True,
            text=True,
            timeout=15,
            check=False,
        )
        if proc.returncode == 0 and proc.stdout.strip():
            return max(float(proc.stdout.strip()), TRIM_MARGIN_SEC * 2 + 1)
    except (OSError, ValueError, subprocess.TimeoutExpired):
        pass
    return DEFAULT_EFFECT_DURATION_SEC


def load_effects_library() -> dict[str, list[tuple[Path, float]]]:
    global _effects_library
    if _effects_library is not None:
        return _effects_library

    lib: dict[str, list[tuple[Path, float]]] = {}
    if not EFFECTS_ROOT.is_dir():
        _effects_library = lib
        return lib

    for folder in sorted(EFFECTS_ROOT.iterdir()):
        if not folder.is_dir() or folder.name.startswith("."):
            continue
        entries: list[tuple[Path, float]] = []
        for path in sorted(folder.iterdir()):
            if path.is_file() and media_kind(path) == "video":
                entries.append((path, probe_duration_sec(path)))
        if entries:
            lib[folder.name] = entries

    _effects_library = lib
    return lib


def pick_effect_clip(category: str, seed: str) -> tuple[Path, float] | None:
    lib = load_effects_library()
    pool = lib.get(category)
    if not pool:
        return None
    idx = int(stable_uniform(seed) * len(pool)) % len(pool)
    return pool[idx]


def pick_start_sec(duration_sec: float, seed: str, play_sec: float) -> float:
    """Random offset avoiding first/last TRIM_MARGIN_SEC of the source clip."""
    margin = TRIM_MARGIN_SEC
    inner_start = margin
    inner_end = duration_sec - margin
    max_start = inner_end - max(play_sec, 0.5)
    if max_start <= inner_start:
        return inner_start
    return inner_start + stable_uniform(seed) * (max_start - inner_start)


def make_overlay(
    *,
    path: Path,
    duration_sec: float,
    seed: str,
    play_sec: float,
    opacity: float,
    placement: str = "full",
    window_sec: float | None = None,
    loop: bool = True,
) -> dict:
    # Specific short clip requested by editorial: always play from beginning.
    if path.name == "n4j77OIbmmw.f399.mp4":
        start = 0.0
    else:
        start = pick_start_sec(duration_sec, seed, play_sec)
    return {
        "src": rel_public(path.resolve()),
        "startFromSec": round(start, 3),
        "blendMode": "plus-lighter",
        "opacity": opacity,
        "placement": placement,
        "windowSec": window_sec,
        "loop": loop,
    }


def build_video_overlays(
    item_id: str,
    effects: list[str],
    transition: str | None,
    shot_duration_sec: float,
) -> list[dict]:
    overlays: list[dict] = []
    seen_categories: set[str] = set()

    for effect_id in effects:
        category = EFFECT_TO_CATEGORY.get(effect_id)
        if not category or category in seen_categories:
            continue
        picked = pick_effect_clip(category, f"{item_id}:{effect_id}")
        if not picked:
            continue
        path, clip_duration = picked
        seen_categories.add(category)
        overlays.append(
            make_overlay(
                path=path,
                duration_sec=clip_duration,
                seed=f"{item_id}:{effect_id}:start",
                play_sec=shot_duration_sec,
                opacity=EFFECT_OPACITY.get(effect_id, 0.7),
                placement="full",
                loop=True,
            )
        )

    if transition and transition not in ("none", "null", ""):
        category = TRANSITION_TO_CATEGORY.get(transition)
        if category:
            picked = pick_effect_clip(category, f"{item_id}:transition:{transition}")
            if picked:
                path, clip_duration = picked
                window = min(TRANSITION_WINDOW_SEC, shot_duration_sec * 0.35)
                overlays.append(
                    make_overlay(
                        path=path,
                        duration_sec=clip_duration,
                        seed=f"{item_id}:transition:{transition}:start",
                        play_sec=window,
                        opacity=TRANSITION_OPACITY.get(transition, 0.85),
                        placement="out",
                        window_sec=window,
                        loop=False,
                    )
                )

    return overlays


OVERLAY_ENGINE_IDS = frozenset({"openai_sticker", "openai_title", "giphy_sticker"})
OVERLAY_PREFIXES = ("sticker-", "title-", "giphy-")

STICKER_SIZE_PERCENT = {"small": 40, "medium": 62, "large": 90}
STICKER_POSITIONS = {
    "center",
    "left",
    "right",
    "top",
    "bottom",
    "top_left",
    "top_right",
    "bottom_left",
    "bottom_right",
}


def sticker_max_percent(acq: dict) -> int:
    raw = acq.get("sticker_overlay_size") or "medium"
    return STICKER_SIZE_PERCENT.get(raw, 62)


def sticker_position(acq: dict) -> str:
    raw = (acq.get("sticker_overlay_position") or "center").strip().lower()
    return raw if raw in STICKER_POSITIONS else "center"


def notes_show_full_image(notes: str) -> bool:
    n = notes.lower()
    return bool(
        re.search(
            r"entire\s+image|full\s+image|whole\s+image|square\s+image|show\s+(the\s+)?entire|"
            r"do\s+not\s+crop|don'?t\s+crop|no\s+crop|not\s+the\s+parent",
            n,
        )
    )


def notes_want_comma_blocks(notes: str) -> bool:
    n = notes.lower()
    return bool(
        re.search(
            r"comma[\s-]*separat|separated\s+block|each\s+comma|comma\s+block",
            n,
        )
    )


def _word_token(word: str) -> str:
    return re.sub(r"^[^a-z0-9]+|[^a-z0-9]+$", "", word.lower())


def load_transcript_words() -> list[dict]:
    if not TRANSCRIPT_JSON.is_file():
        return []
    try:
        doc = json.loads(TRANSCRIPT_JSON.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []
    return doc.get("words") or []


def comma_block_start_frames(
    text: str,
    t_start: float,
    t_end: float,
    fps: int,
    words: list[dict],
) -> list[int] | None:
    """Frame offsets (from cue start) when each comma-separated phrase is spoken."""
    blocks = [p.strip() for p in text.split(",") if p.strip()]
    if len(blocks) < 2 or not words:
        return None

    cue_words = [
        w
        for w in words
        if float(w.get("start", 0)) >= t_start - 0.02
        and float(w.get("end", 0)) <= t_end + 0.1
    ]
    if not cue_words:
        return None

    lead_frames = 3
    frame_starts: list[int] = []
    last_word_start = t_start - 0.5

    for block in blocks:
        first = _word_token(block.split()[0])
        hit_at: float | None = None
        for w in cue_words:
            if _word_token(w.get("word", "")) == first and float(w["start"]) >= last_word_start + 0.01:
                hit_at = float(w["start"])
                break
        if hit_at is None:
            return None
        rel_frames = round((hit_at - t_start) * fps)
        if frame_starts:
            rel_frames = max(0, rel_frames - lead_frames)
        frame_starts.append(rel_frames)
        last_word_start = hit_at

    for i in range(1, len(frame_starts)):
        if frame_starts[i] <= frame_starts[i - 1]:
            frame_starts[i] = frame_starts[i - 1] + 1
    return frame_starts


def is_overlay_filename(name: str) -> bool:
    lower = name.lower()
    return lower.startswith(OVERLAY_PREFIXES)


def is_overlay_selection(sel: dict) -> bool:
    if sel.get("engine_id") in OVERLAY_ENGINE_IDS:
        return True
    rid = sel.get("result_id", "")
    if "local-acquired:" in rid:
        return is_overlay_filename(rid.split(":", 1)[-1])
    url = sel.get("url") or ""
    if "/acquired/" in url:
        return is_overlay_filename(url.rsplit("/", 1)[-1])
    return False


def library_path_from_public_url(url: str) -> Path | None:
    """Resolve /media/_library/assets/<id>/<file> to disk path."""
    if not url.startswith("/media/"):
        return None
    parts = [unquote(part) for part in url.split("/media/", 1)[-1].split("/")]
    if len(parts) < 4 or parts[0] != LIBRARY_SLUG or parts[1] != "assets":
        return None
    path = MEDIA_PUBLIC.joinpath(*parts)
    return path if path.is_file() else None


def library_path_from_asset_id(asset_id: str) -> Path | None:
    """Resolve library:<id> via asset meta.json or first non-meta file."""
    asset_dir = MEDIA_PUBLIC / LIBRARY_SLUG / "assets" / asset_id
    if not asset_dir.is_dir():
        return None
    meta_path = asset_dir / "meta.json"
    if meta_path.is_file():
        try:
            doc = json.loads(meta_path.read_text(encoding="utf-8"))
            name = doc.get("filename") or doc.get("original_filename")
            if name:
                path = asset_dir / name
                if path.is_file():
                    return path
        except (json.JSONDecodeError, OSError):
            pass
    for candidate in sorted(asset_dir.iterdir()):
        if candidate.is_file() and candidate.name != "meta.json":
            return candidate
    return None


def selection_to_path(item_id: str, sel: dict) -> Path | None:
    url = sel.get("url") or ""
    result_id = sel.get("result_id", "")

    if result_id.startswith("library:"):
        path = library_path_from_public_url(url)
        if path:
            return path
        asset_id = result_id.split(":", 1)[-1]
        path = library_path_from_asset_id(asset_id)
        if path:
            return path

    if "local-acquired:" in result_id:
        name = result_id.split(":", 1)[-1]
        p = MEDIA_ROOT / item_id / "acquired" / name
        if p.is_file():
            return p
    if url.startswith("/media/"):
        path = library_path_from_public_url(url)
        if path:
            return path
        rel = url.split("/media/", 1)[-1]
        parts = rel.split("/")
        if len(parts) >= 4 and parts[2] == "acquired":
            p = MEDIA_ROOT / parts[1] / "acquired" / parts[-1]
            if p.is_file():
                return p
    return None


def iter_selections(acq: dict):
    for q in acq.get("queries") or []:
        for sel in q.get("selections") or []:
            yield sel


def _overlay_basename(sel: dict) -> str:
    rid = sel.get("result_id", "")
    if "local-acquired:" in rid:
        return rid.split(":", 1)[-1]
    url = sel.get("url") or ""
    if "/acquired/" in url:
        return url.rsplit("/", 1)[-1]
    if "/media/_library/assets/" in url:
        return unquote(url.rsplit("/", 1)[-1].split("?")[0])
    return ""


def pick_overlay_file(
    item_id: str, acq: dict, engine_id: str
) -> Path | None:
    want_title = engine_id == "openai_title"
    if want_title:
        want_prefix = "title-"
    elif engine_id == "giphy_sticker":
        want_prefix = "giphy-"
    else:
        want_prefix = "sticker-"
    for sel in iter_selections(acq):
        if sel.get("engine_id") == engine_id:
            p = selection_to_path(item_id, sel)
            if p and p.is_file() and media_kind(p) == "image":
                return p
        base = _overlay_basename(sel)
        if base.lower().startswith(want_prefix):
            p = selection_to_path(item_id, sel)
            if p and p.is_file() and media_kind(p) == "image":
                return p
    prefix = want_prefix
    acquired_dir = MEDIA_ROOT / item_id / "acquired"
    if acquired_dir.is_dir():
        for name in sorted(acquired_dir.iterdir()):
            if name.is_file() and name.name.lower().startswith(prefix):
                return acquired_dir / name.name
    return None


def selection_start_from_sec(sel: dict) -> float | None:
    raw = sel.get("start_from_sec")
    if raw is None:
        return None
    try:
        sec = float(raw)
    except (TypeError, ValueError):
        return None
    return sec if sec > 0 else None


def plate_frame_dict(path: Path, start_from_sec: float | None) -> dict:
    frame = {
        "src": rel_public(path.resolve()),
        "mediaKind": media_kind(path),
    }
    if start_from_sec is not None and media_kind(path) == "video":
        frame["startFromSec"] = start_from_sec
    return frame


def pick_plate_media_entries(
    item_id: str, acq: dict, manifest: dict | None
) -> list[dict]:
    """Non-overlay plate files in acquisition selection order + optional in-points."""
    entries: list[dict] = []
    seen: set[str] = set()
    for sel in iter_selections(acq):
        if is_overlay_selection(sel):
            continue
        p = selection_to_path(item_id, sel)
        if not p or not p.is_file():
            continue
        if media_kind(p) not in ("image", "video"):
            continue
        key = str(p.resolve())
        if key in seen:
            continue
        seen.add(key)
        entries.append({"path": p, "start_from_sec": selection_start_from_sec(sel)})
    if entries:
        return entries

    names: list[str] = []
    if manifest:
        names.extend(manifest.get("acquired_files") or [])
    acquired_dir = MEDIA_ROOT / item_id / "acquired"
    if acquired_dir.is_dir():
        for name in sorted(acquired_dir.iterdir()):
            if name.is_file() and name.name != ".gitkeep":
                if name.name not in names:
                    names.append(name.name)
    for name in names:
        if is_overlay_filename(name):
            continue
        p = acquired_dir / name
        if p.is_file() and media_kind(p) in ("image", "video"):
            key = str(p.resolve())
            if key not in seen:
                seen.add(key)
                entries.append({"path": p, "start_from_sec": None})
    return entries


def pick_plate_media_files(item_id: str, acq: dict, manifest: dict | None) -> list[Path]:
    return [e["path"] for e in pick_plate_media_entries(item_id, acq, manifest)]


def apply_plate_media_to_shot(shot: dict, plate_entries: list[dict]) -> None:
    if not plate_entries:
        return
    frames = [
        plate_frame_dict(e["path"], e.get("start_from_sec"))
        for e in plate_entries
    ]
    if len(frames) > 1:
        shot["plateSequence"] = frames
    first = frames[0]
    shot["src"] = first["src"]
    shot["mediaKind"] = first["mediaKind"]
    if first.get("startFromSec") is not None:
        shot["startFromSec"] = first["startFromSec"]
    shot["missingMedia"] = False


def pick_media_file(item_id: str, acq: dict, manifest: dict | None) -> Path | None:
    plates = pick_plate_media_files(item_id, acq, manifest)
    return plates[0] if plates else None


def read_show_cue_overlay() -> bool:
    """media_tool toggle → preview-settings.json and/or project.json."""
    preview_path = PREVIEW_SETTINGS
    if preview_path.is_file():
        try:
            doc = json.loads(preview_path.read_text(encoding="utf-8"))
            if doc.get("showCueOverlay") is False:
                return False
            if doc.get("showCueOverlay") is True:
                return True
        except (json.JSONDecodeError, OSError):
            pass
    project_path = MEDIA_ROOT / "project.json"
    if project_path.is_file():
        try:
            doc = json.loads(project_path.read_text(encoding="utf-8"))
            if doc.get("remotion_show_cue_overlay") is False:
                return False
        except (json.JSONDecodeError, OSError):
            pass
    return True


def read_show_sticker_overlays() -> bool:
    """OpenAI/GIPHY sticker + title PNG overlays (preview-settings.json)."""
    preview_path = PREVIEW_SETTINGS
    if preview_path.is_file():
        try:
            doc = json.loads(preview_path.read_text(encoding="utf-8"))
            if doc.get("showStickerOverlays") is False:
                return False
            if doc.get("showStickerOverlays") is True:
                return True
        except (json.JSONDecodeError, OSError):
            pass
    return True


def compute_preroll_sec(items: list[dict]) -> float:
    """Silence + title card before VO: duration of m000 when it has no spoken line."""
    for item in items:
        if item.get("id") != "m000":
            continue
        if (item.get("spoken") or "").strip():
            return 0.0
        return max(0.0, float(item["t_end"]) - float(item["t_start"]))
    return 0.0


def timings_already_include_preroll(items: list[dict], preroll_sec: float) -> bool:
    """True when manifest t_start values are video-absolute (m000 slot already baked in).

    Episodes from build_media_search.py keep SRT/audio times (m001 often starts before
    m000 ends). Hand-built manifests (e.g. sandbox) may place m001 at t_start >= m000.t_end.
    """
    if preroll_sec <= 0:
        return False
    m000_end = next(
        (float(it["t_end"]) for it in items if it.get("id") == "m000"),
        None,
    )
    if m000_end is None:
        return False
    for item in items:
        if item.get("id") == "m000":
            continue
        return float(item["t_start"]) >= m000_end - 1e-6
    return False


def compute_preroll_offset_sec(items: list[dict], preroll_sec: float) -> float:
    """Extra timeline shift for audio-relative manifests; 0 when timings already include m000."""
    if preroll_sec <= 0 or timings_already_include_preroll(items, preroll_sec):
        return 0.0
    return preroll_sec


def build_shot(
    item: dict,
    acq: dict,
    manifest: dict | None,
    fps: int,
    transcript_words: list[dict] | None = None,
    preroll_sec: float = 0.0,
    preroll_offset_sec: float | None = None,
) -> dict:
    item_id = item["id"]
    mode = acq.get("resolved_visual_mode") or item.get("visual_mode", "historical")
    t_start = float(item["t_start"])
    t_end = float(item["t_end"])
    duration_sec = max(t_end - t_start, 0.12)

    lead_in_sec, lead_out_sec = SPECIAL_TIMING.get(item_id, (0.0, 0.0))
    t_start_adj = max(0.0, t_start - lead_in_sec)
    t_end_adj = t_end + lead_out_sec

    offset_sec = preroll_sec if preroll_offset_sec is None else preroll_offset_sec
    preroll_frames = round(offset_sec * fps) if item_id != "m000" else 0
    from_frame = round(t_start_adj * fps) + preroll_frames
    duration_frames = max(1, round((t_end_adj - t_start_adj) * fps))

    plate_entries = pick_plate_media_entries(item_id, acq, manifest)
    media_path = plate_entries[0]["path"] if plate_entries else None
    resolved_type = acq.get("resolved_media_type", "photo")

    notes_raw = acq.get("notes")
    notes = (notes_raw or "").strip() if isinstance(notes_raw, str) else ""

    effects = effects_respecting_notes(list(acq.get("effects") or []), notes)
    transition = acq.get("transition")
    overlays = build_video_overlays(item_id, effects, transition, duration_sec)

    media_delay_sec = SPECIAL_MEDIA_DELAY.get(item_id, 0.0)
    # Title preroll already holds m001 plate until VO; ep001 delay was for pre-preroll audio.
    if preroll_sec > 0 and item_id == "m001":
        media_delay_sec = 0.0
    media_scale = SPECIAL_MEDIA_SCALE.get(item_id)
    media_fit = SPECIAL_MEDIA_FIT.get(item_id)
    motion = SPECIAL_MOTION.get(item_id, {})

    shot: dict = {
        "id": item_id,
        "cue": item["cue"],
        "fromFrame": from_frame,
        "durationInFrames": duration_frames,
        "mediaDelayFrames": round(media_delay_sec * fps) if media_delay_sec > 0 else 0,
        "mediaScale": media_scale if media_scale is not None else 1.0,
        "mediaFit": media_fit,
        "motionTiltDeg": motion.get("tiltDeg"),
        "motionScrollSpeed": motion.get("scrollSpeed"),
        "tStart": t_start,
        "tEnd": t_end,
        "spoken": item.get("spoken", ""),
        "notes": notes or None,
        "visualMode": mode,
        "mediaType": resolved_type,
        "backgroundColor": acq.get("background_color") or "#000000",
        "effects": effects,
        "transition": transition,
        "textGraphic": acq.get("text_graphic"),
        "textGraphicLayer": acq.get("text_graphic_layer"),
        "src": None,
        "mediaKind": "none",
        "overlaySrc": overlays[0]["src"] if overlays else None,
        "overlays": overlays,
        "missingMedia": False,
    }

    sticker_path = pick_overlay_file(item_id, acq, "openai_sticker")
    if not sticker_path:
        sticker_path = pick_overlay_file(item_id, acq, "giphy_sticker")
    title_path = pick_overlay_file(item_id, acq, "openai_title")
    if (
        sticker_path
        and sticker_path.is_file()
        and acq.get("sticker_overlay_enabled") is not False
    ):
        shot["stickerSrc"] = rel_public(sticker_path.resolve())
        shot["stickerMaxPercent"] = sticker_max_percent(acq)
        shot["stickerPosition"] = sticker_position(acq)
        hide_after = sticker_hide_after_sec(item_id, notes)
        if hide_after is not None:
            shot["stickerHideAfterSec"] = hide_after
        sticker_fx = sticker_effects_for_shot(item_id, notes)
        if sticker_fx:
            shot["stickerEffects"] = sticker_fx
    if (
        title_path
        and title_path.is_file()
        and acq.get("title_overlay_enabled") is not False
    ):
        shot["titleOverlaySrc"] = rel_public(title_path.resolve())

    if mode == "effect_only":
        if plate_entries:
            apply_plate_media_to_shot(shot, plate_entries)
            if notes and notes_show_full_image(notes):
                shot["mediaFit"] = "contain"
        else:
            shot["mediaKind"] = "none"
        # Typography is text_graphic mode only — resolved_visual_mode controls render.
        shot["textGraphic"] = None
        return shot

    if mode == "text_graphic":
        shot["mediaKind"] = "generated"
        tg = acq.get("text_graphic") or {}
        tg_text = (tg.get("text") or item.get("spoken") or "").strip()
        if tg_text:
            shot["textGraphic"] = {
                "type": tg.get("type") or "transcription",
                "text": tg_text,
                "style": tg.get("style") or "typewriter",
            }
            if tg.get("optional_texture"):
                shot["textGraphic"]["optional_texture"] = tg["optional_texture"]
        if item_id in SPECIAL_TEXT_REVEAL_SPEED:
            shot["textRevealSpeedMult"] = SPECIAL_TEXT_REVEAL_SPEED[item_id]
        if notes and notes_want_comma_blocks(notes) and tg_text and transcript_words:
            starts = comma_block_start_frames(
                tg_text, t_start, t_end, fps, transcript_words
            )
            if starts:
                shot["textBlockStartFrames"] = starts
        return shot

    if notes and notes_show_full_image(notes):
        shot["mediaFit"] = "contain"

    if plate_entries:
        apply_plate_media_to_shot(shot, plate_entries)
    elif sticker_path or title_path:
        shot["mediaKind"] = "none"
        shot["missingMedia"] = False
        if shot.get("stickerSrc") or shot.get("titleOverlaySrc"):
            shot["textGraphic"] = None
    else:
        shot["missingMedia"] = True

    return shot


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--episode",
        default=DEFAULT_EPISODE_ID,
        help=f"Episode folder name under episodes/ (default: {DEFAULT_EPISODE_ID})",
    )
    parser.add_argument("--max", default="m035", help="Last cue id inclusive (e.g. m035)")
    parser.add_argument("--fps", type=int, default=30)
    parser.add_argument(
        "--out",
        type=Path,
        default=None,
        help="Output timeline.json (default: remotion/src/timeline.json)",
    )
    parser.add_argument(
        "--audio",
        type=Path,
        default=None,
        help="Master VO mp3 (default: from episode.json)",
    )
    args = parser.parse_args()

    configure_episode(args.episode)
    out_path = args.out or DEFAULT_OUT
    audio_path = args.audio or DEFAULT_AUDIO
    has_audio = audio_path.is_file()

    max_n = parse_max_id(args.max)
    ensure_remotion_public_links()
    ensure_remotion_preview_settings()
    data = json.loads(MEDIA_SEARCH.read_text(encoding="utf-8"))
    items = [it for it in data["items"] if parse_max_id(it["id"]) <= max_n]

    transcript_words = load_transcript_words()
    preroll_sec = compute_preroll_sec(items)
    preroll_offset_sec = compute_preroll_offset_sec(items, preroll_sec)
    audio_from_frame = round(preroll_offset_sec * args.fps)
    shots: list[dict] = []
    missing = 0
    for item in items:
        item_id = item["id"]
        acq_path = MEDIA_ROOT / item_id / "acquisition.json"
        man_path = MEDIA_ROOT / item_id / "asset_manifest.json"
        acq = (
            json.loads(acq_path.read_text(encoding="utf-8"))
            if acq_path.is_file()
            else {}
        )
        manifest = (
            json.loads(man_path.read_text(encoding="utf-8"))
            if man_path.is_file()
            else None
        )
        shot = build_shot(
            item,
            acq,
            manifest,
            args.fps,
            transcript_words,
            preroll_sec,
            preroll_offset_sec,
        )
        if shot.get("missingMedia") and shot["visualMode"] not in (
            "text_graphic",
            "effect_only",
        ):
            missing += 1
        shots.append(shot)

    end_sec = max(float(it["t_end"]) for it in items)
    duration_frames = round((end_sec + preroll_offset_sec) * args.fps) + args.fps

    doc = {
        "version": 1,
        "built_at": datetime.now(timezone.utc).isoformat(),
        "episode": EPISODE_ID,
        "max_id": f"m{max_n:03d}",
        "fps": args.fps,
        "width": 1920,
        "height": 1080,
        "durationInFrames": duration_frames,
        "showCueOverlay": read_show_cue_overlay(),
        "showStickerOverlays": read_show_sticker_overlays(),
        "shots": shots,
        "stats": {
            "shot_count": len(shots),
            "missing_media": missing,
            "end_sec": end_sec,
        },
    }
    if has_audio:
        doc["audioFromFrame"] = audio_from_frame
        doc["audioSrc"] = rel_public(audio_path.resolve())
    else:
        print(f"  No master audio at {audio_path} — rendering without VO")

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(doc, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {out_path}")
    if preroll_sec > 0 and preroll_offset_sec > 0:
        preroll_note = f" · preroll {preroll_offset_sec:.2f}s"
    elif preroll_sec > 0:
        preroll_note = f" · m000 {preroll_sec:.2f}s (timings include title slot)"
    else:
        preroll_note = ""
    print(
        f"  {len(shots)} shots · ends {end_sec:.2f}s · {duration_frames} frames @ {args.fps}fps{preroll_note}"
    )
    print(f"  {missing} shots missing acquired media (will show placeholder)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
