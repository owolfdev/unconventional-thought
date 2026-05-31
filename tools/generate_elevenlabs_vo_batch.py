#!/usr/bin/env python3
"""
Generate full episode VO in named partials, then join with a seek manifest.

  python3 tools/generate_elevenlabs_vo_batch.py \\
    episodes/002_DidBonScottKnowHeWasGoingToDie/did_bon_scott_know_he_was_going_to_die.txt

Re-run one partial after edits:

  python3 tools/generate_elevenlabs_vo_batch.py ... --only 05-who-is-devil-heroin --join
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
DEFAULT_ENV = REPO / "media_tool" / ".env.local"
MAX_CHARS = 4800  # eleven_v3 limit 5000; leave headroom
GAP_SEC = 0.6
REVIEW_WIDTH = 1920
REVIEW_HEIGHT = 1080
REVIEW_FPS = 30
FONT_FILE = "/System/Library/Fonts/Supplemental/Arial.ttf"


@dataclass
class Part:
    index: int
    slug: str
    filename: str
    text: str


def load_dotenv(path: Path) -> None:
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key, value = key.strip(), value.strip()
        if key and key not in os.environ:
            os.environ[key] = value


def slugify(text: str, fallback: str) -> str:
    """Derive a short slug from first spoken line."""
    for line in text.splitlines():
        line = line.strip()
        if not line or line == "---":
            continue
        plain = re.sub(r"\[[^\]]+\]", "", line)
        plain = re.sub(r"[^a-zA-Z0-9]+", "-", plain).strip("-").lower()
        if len(plain) >= 4:
            return plain[:48].strip("-")
    return fallback


def split_script(raw: str) -> list[Part]:
    blocks = re.split(r"^\s*---\s*$", raw, flags=re.MULTILINE)
    parts: list[Part] = []
    for i, block in enumerate(blocks, start=1):
        text = block.strip()
        if not text:
            continue
        fallback = f"section-{i:02d}"
        slug = slugify(text, fallback)
        parts.append(
            Part(
                index=i,
                slug=slug,
                filename=f"part-{i:02d}-{slug}.mp3",
                text=text,
            )
        )
    return parts


def split_oversized(part: Part) -> list[Part]:
    if len(part.text) <= MAX_CHARS:
        return [part]
    chunks: list[Part] = []
    paras = [p.strip() for p in re.split(r"\n\s*\n", part.text) if p.strip()]
    buf: list[str] = []
    buf_len = 0
    sub = 0
    for para in paras:
        add_len = len(para) + (2 if buf else 0)
        if buf and buf_len + add_len > MAX_CHARS:
            sub += 1
            text = "\n\n".join(buf)
            chunks.append(
                Part(
                    index=part.index,
                    slug=f"{part.slug}-chunk{sub}",
                    filename=f"part-{part.index:02d}-{part.slug}-chunk{sub:02d}.mp3",
                    text=text,
                )
            )
            buf, buf_len = [], 0
        buf.append(para)
        buf_len += add_len
    if buf:
        sub += 1
        text = "\n\n".join(buf)
        chunks.append(
            Part(
                index=part.index,
                slug=f"{part.slug}-chunk{sub}" if sub > 1 else part.slug,
                filename=(
                    f"part-{part.index:02d}-{part.slug}.mp3"
                    if sub == 1 and not chunks
                    else f"part-{part.index:02d}-{part.slug}-chunk{sub:02d}.mp3"
                ),
                text=text,
            )
        )
    return chunks


def elevenlabs_tts(
    text: str,
    *,
    api_key: str,
    voice_id: str,
    model_id: str,
) -> bytes:
    url = (
        f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
        "?output_format=mp3_44100_128"
    )
    payload = {
        "text": text,
        "model_id": model_id,
        "voice_settings": {"stability": 0.45, "similarity_boost": 0.8},
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "xi-api-key": api_key,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=600) as resp:
            return resp.read()
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        raise SystemExit(f"ElevenLabs API error {e.code}: {body}") from e


def ffprobe_duration(path: Path) -> float:
    out = subprocess.run(
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
        check=True,
    )
    return float(out.stdout.strip())


def make_silence_mp3(path: Path, duration_sec: float) -> None:
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-f",
            "lavfi",
            "-i",
            "anullsrc=r=44100:cl=mono",
            "-t",
            str(duration_sec),
            "-c:a",
            "libmp3lame",
            "-q:a",
            "5",
            str(path),
        ],
        capture_output=True,
        check=True,
    )


def wrap_label(filename: str, width: int = 46) -> list[str]:
    """Break a long partial filename into centered lines."""
    if len(filename) <= width:
        return [filename]
    parts = filename.replace(".mp3", "").split("-")
    lines: list[str] = []
    current = ""
    for piece in parts:
        candidate = f"{current}-{piece}" if current else piece
        if len(candidate) <= width:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = piece
    if current:
        suffix = ".mp3" if filename.endswith(".mp3") else ""
        lines.append(current + suffix)
    return lines or [filename]


def make_title_png(
    out_path: Path,
    label: str,
    *,
    part_num: int,
    part_total: int,
) -> None:
    lines = wrap_label(label)
    y0 = REVIEW_HEIGHT // 2 - 60 - (len(lines) * 26)
    cmd = [
        "magick",
        "-size",
        f"{REVIEW_WIDTH}x{REVIEW_HEIGHT}",
        "xc:black",
        "-font",
        FONT_FILE if Path(FONT_FILE).is_file() else "Helvetica",
        "-fill",
        "#888888",
        "-pointsize",
        "36",
        "-gravity",
        "north",
        "-annotate",
        f"+0+{y0}",
        f"Part {part_num} of {part_total}",
    ]
    for i, line in enumerate(lines):
        cmd.extend(
            [
                "-fill",
                "white",
                "-pointsize",
                "40",
                "-annotate",
                f"+0+{y0 + 56 + i * 52}",
                line,
            ]
        )
    cmd.append(str(out_path))
    subprocess.run(cmd, check=True, capture_output=True)


def render_review_segment(
    audio_path: Path,
    label: str,
    out_path: Path,
    *,
    part_num: int,
    part_total: int,
) -> None:
    png_path = out_path.with_suffix(".png")
    make_title_png(
        png_path,
        label,
        part_num=part_num,
        part_total=part_total,
    )
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-loop",
            "1",
            "-framerate",
            str(REVIEW_FPS),
            "-i",
            str(png_path),
            "-i",
            str(audio_path),
            "-c:v",
            "libx264",
            "-preset",
            "fast",
            "-crf",
            "23",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-shortest",
            str(out_path),
        ],
        check=True,
        capture_output=True,
    )


def build_review_video(
    entries: list[dict],
    parts_dir: Path,
    gap_mp3: Path | None,
    out_mp4: Path,
) -> None:
    """Join partials into a review MP4: black frame + current partial filename."""
    segments_dir = parts_dir / "_review_segments"
    segments_dir.mkdir(parents=True, exist_ok=True)
    total = len(entries)
    segment_paths: list[Path] = []

    for i, entry in enumerate(entries):
        seg_path = segments_dir / f"seg-{entry['index']:02d}.mp4"
        print(f"  review segment {entry['filename']}")
        render_review_segment(
            Path(entry["path"]),
            entry["filename"],
            seg_path,
            part_num=i + 1,
            part_total=total,
        )
        segment_paths.append(seg_path)

        if gap_mp3 and i < total - 1:
            gap_seg = segments_dir / f"gap-{entry['index']:02d}.mp4"
            render_review_segment(
                gap_mp3,
                entry["filename"],
                gap_seg,
                part_num=i + 1,
                part_total=total,
            )
            segment_paths.append(gap_seg)

    concat_list = segments_dir / "_concat.txt"
    concat_list.write_text(
        "\n".join(f"file '{p.resolve()}'" for p in segment_paths) + "\n",
        encoding="utf-8",
    )
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(concat_list),
            "-c",
            "copy",
            "-movflags",
            "+faststart",
            str(out_mp4),
        ],
        check=True,
    )


def join_audio_mp3(
    entries: list[dict],
    parts_dir: Path,
    gap_mp3: Path | None,
    out_mp3: Path,
) -> None:
    concat_list = parts_dir / "_concat.txt"
    lines: list[str] = []
    for e in entries:
        lines.append(f"file '{e['path']}'")
        if gap_mp3 and e is not entries[-1]:
            lines.append(f"file '{gap_mp3}'")
    concat_list.write_text("\n".join(lines) + "\n", encoding="utf-8")

    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(concat_list),
            "-c",
            "copy",
            str(out_mp3),
        ],
        check=True,
    )


def write_chapters_ffmeta(entries: list[dict], ffmeta: Path) -> None:
    meta_lines = [";FFMETADATA1"]
    for e in entries:
        start_ms = int(e["start_sec"] * 1000)
        end_ms = int(e["end_sec"] * 1000)
        title = e["filename"].replace("'", "\\'")
        meta_lines.extend(
            [
                "",
                "[CHAPTER]",
                "TIMEBASE=1/1000",
                f"START={start_ms}",
                f"END={end_ms}",
                f"title={title}",
            ]
        )
    ffmeta.write_text("\n".join(meta_lines) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("script", type=Path)
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=None,
        help="Default: <episode>/audio/vo",
    )
    parser.add_argument("--env", type=Path, default=DEFAULT_ENV)
    parser.add_argument(
        "--only",
        action="append",
        default=[],
        help="Regenerate partials matching slug substring (e.g. 05-who-is-devil)",
    )
    parser.add_argument("--skip-existing", action="store_true")
    parser.add_argument("--join", action="store_true", help="Join after generate")
    parser.add_argument("--join-only", action="store_true", help="Join existing partials")
    parser.add_argument(
        "--review-only",
        action="store_true",
        help="Rebuild review MP4 from existing partials (no TTS)",
    )
    args = parser.parse_args()

    load_dotenv(args.env)
    api_key = os.environ.get("ELEVENLABS_API_KEY", "").strip()
    voice_id = os.environ.get("ELEVENLABS_VOICE_ID", "").strip()
    model_id = os.environ.get("ELEVENLABS_MODEL", "eleven_v3").strip()
    if not api_key or not voice_id:
        raise SystemExit("Set ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID")

    script_path = args.script.resolve()
    episode_dir = script_path.parent
    vo_dir = args.out_dir or (episode_dir / "audio" / "vo")
    parts_dir = vo_dir / "parts"
    parts_dir.mkdir(parents=True, exist_ok=True)

    stem = script_path.stem
    master_mp3 = vo_dir / f"{stem}.mp3"
    master_mp4 = vo_dir / f"{stem}.mp4"
    manifest_path = vo_dir / "vo_assembly.json"
    ffmeta_path = vo_dir / "chapters.ffmetadata"
    gap_path = parts_dir / "_gap.mp3"

    raw = script_path.read_text(encoding="utf-8")
    parts: list[Part] = []
    for p in split_script(raw):
        parts.extend(split_oversized(p))

    if not args.join_only and not args.review_only:
        for part in parts:
            if args.only and not any(f in part.filename for f in args.only):
                continue
            out_path = parts_dir / part.filename
            if args.skip_existing and out_path.is_file() and out_path.stat().st_size > 0:
                print(f"skip {part.filename}")
                continue
            print(f"\n=== {part.filename} ({len(part.text)} chars) ===")
            audio = elevenlabs_tts(
                part.text,
                api_key=api_key,
                voice_id=voice_id,
                model_id=model_id,
            )
            out_path.write_bytes(audio)
            print(f"  wrote {out_path} ({len(audio) // 1024} KB)")
            time.sleep(0.5)

    if args.join_only or args.review_only:
        pass
    elif args.only and not args.join:
        print("Partials updated. Re-run with --join to rebuild master.")
        return 0

    if not gap_path.is_file():
        make_silence_mp3(gap_path, GAP_SEC)

    entries: list[dict] = []
    cursor = 0.0
    for part in parts:
        path = parts_dir / part.filename
        if not path.is_file():
            raise SystemExit(f"Missing partial: {path}")
        dur = ffprobe_duration(path)
        start = cursor
        end = cursor + dur
        entries.append(
            {
                "filename": part.filename,
                "slug": part.slug,
                "index": part.index,
                "chars": len(part.text),
                "start_sec": round(start, 3),
                "end_sec": round(end, 3),
                "duration_sec": round(dur, 3),
                "path": str(path.resolve()),
            }
        )
        cursor = end + GAP_SEC

    manifest = {
        "script": str(script_path),
        "voice_id": voice_id,
        "model_id": model_id,
        "gap_sec": GAP_SEC,
        "master_mp3": str(master_mp3),
        "master_mp4": str(master_mp4),
        "total_duration_sec": round(cursor - GAP_SEC, 3),
        "parts": entries,
    }
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"\nWrote {manifest_path}")

    join_audio_mp3(entries, parts_dir, gap_path, master_mp3)
    write_chapters_ffmeta(entries, ffmeta_path)
    print(f"Wrote {master_mp3}")

    print("\nBuilding review video (1920x1080, partial labels on screen)...")
    build_review_video(entries, parts_dir, gap_path, master_mp4)
    print(f"Wrote {master_mp4} (review video with partial filenames)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
