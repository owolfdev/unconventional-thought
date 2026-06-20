"""Resolve episode directories and paths under episodes/."""

from __future__ import annotations

import json
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
EPISODES_DIR = REPO / "episodes"
REMOTION_DIR = REPO / "remotion"
MEDIA_PUBLIC = REPO / "media_tool" / "public" / "media"
DEFAULT_EPISODE_ID = "001_WhoWroteBackInBlack"


def resolve_episode_dir(episode_id: str) -> Path:
    """Find episode folder under episodes/ or legacy repo root."""
    for candidate in (EPISODES_DIR / episode_id, REPO / episode_id):
        if candidate.is_dir():
            return candidate.resolve()
    raise SystemExit(
        f"Episode directory not found: {episode_id!r}\n"
        f"  Expected: {EPISODES_DIR / episode_id}"
    )


def load_episode_json(episode_dir: Path) -> dict:
    path = episode_dir / "episode.json"
    if not path.is_file():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def episode_paths(episode_id: str) -> dict[str, Path]:
    """Paths used by timeline builder, media_tool, and Remotion."""
    ep = resolve_episode_dir(episode_id)
    cfg = load_episode_json(ep)
    return {
        "repo": REPO,
        "episode_id": episode_id,
        "episode_dir": ep,
        "media_root": MEDIA_PUBLIC / episode_id,
        "remotion_dir": REMOTION_DIR,
        "remotion_public": REMOTION_DIR / "public",
        "media_search": ep / cfg.get("timeline_manifest", "timeline/media_search.json"),
        "audio_master": resolve_audio_master(ep, cfg),
        "transcript_json": ep / cfg.get(
            "transcript_json", "transcript/who_wrote_back_in_black.json"
        ),
        "preview_settings": ep / "preview-settings.json",
        "timeline_out": REMOTION_DIR / "src" / "timeline.json",
    }


def resolve_audio_master(ep: Path, cfg: dict) -> Path:
    """Master VO path for timeline; may not exist (e.g. sandbox)."""
    if "audio_master" in cfg:
        raw = cfg["audio_master"]
        if raw is None or raw == "":
            return ep / "audio" / "master" / ".none.mp3"
        p = Path(raw)
        return p if p.is_absolute() else ep / p
    master_dir = ep / "audio" / "master"
    if master_dir.is_dir():
        for pattern in ("*.mp3", "*.wav", "*.m4a"):
            matches = sorted(master_dir.glob(pattern))
            if matches:
                return matches[0]
    vo_dir = ep / "audio" / "vo"
    if vo_dir.is_dir():
        for pattern in ("*.mp3", "*.wav", "*.m4a"):
            matches = sorted(vo_dir.glob(pattern))
            if matches:
                return matches[0]
    return ep / "audio" / "master" / ".none.mp3"
