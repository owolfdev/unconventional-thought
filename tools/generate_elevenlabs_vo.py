#!/usr/bin/env python3
"""
Generate VO from a tagged script using ElevenLabs (eleven_v3).

Reads ELEVENLABS_* from media_tool/.env.local (or environment).

  python3 tools/generate_elevenlabs_vo.py \\
    episodes/002_DidBonScottKnowHeWasGoingToDie/did_bon_scott_know_he_was_going_to_die.txt \\
    --lines 13 \\
    --out episodes/002_DidBonScottKnowHeWasGoingToDie/audio/preview/opening_sample.mp3
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
DEFAULT_ENV = REPO / "media_tool" / ".env.local"


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


def extract_opening(script_path: Path, max_lines: int | None, until_section: bool) -> str:
    lines: list[str] = []
    for raw in script_path.read_text(encoding="utf-8").splitlines():
        stripped = raw.strip()
        if until_section and stripped == "---":
            break
        if max_lines is not None and len(lines) >= max_lines:
            break
        lines.append(raw.rstrip())
    text = "\n".join(lines).strip()
    if not text:
        raise SystemExit("No script text extracted.")
    return text


def elevenlabs_tts(
    text: str,
    *,
    api_key: str,
    voice_id: str,
    model_id: str,
    stability: float = 0.45,
    similarity_boost: float = 0.8,
) -> bytes:
    url = (
        f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
        "?output_format=mp3_44100_128"
    )
    payload = {
        "text": text,
        "model_id": model_id,
        "voice_settings": {
            "stability": stability,
            "similarity_boost": similarity_boost,
        },
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
        with urllib.request.urlopen(req, timeout=300) as resp:
            return resp.read()
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        raise SystemExit(f"ElevenLabs API error {e.code}: {body}") from e


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("script", type=Path, help="Tagged script .txt")
    parser.add_argument(
        "--lines",
        type=int,
        default=None,
        help="Max lines from start (default: until first ---)",
    )
    parser.add_argument(
        "--until-section",
        action="store_true",
        default=True,
        help="Stop at first --- (default: on)",
    )
    parser.add_argument(
        "--no-until-section",
        action="store_false",
        dest="until_section",
        help="Ignore ---; use --lines only",
    )
    parser.add_argument("--out", type=Path, required=True, help="Output .mp3 path")
    parser.add_argument("--env", type=Path, default=DEFAULT_ENV)
    args = parser.parse_args()

    load_dotenv(args.env)

    api_key = os.environ.get("ELEVENLABS_API_KEY", "").strip()
    voice_id = os.environ.get("ELEVENLABS_VOICE_ID", "").strip()
    model_id = os.environ.get("ELEVENLABS_MODEL", "eleven_v3").strip()

    if not api_key or not voice_id:
        raise SystemExit(
            "Set ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID in media_tool/.env.local"
        )

    script_path = args.script.resolve()
    if not script_path.is_file():
        raise SystemExit(f"Script not found: {script_path}")

    text = extract_opening(script_path, args.lines, args.until_section)
    print(f"Script: {script_path}")
    print(f"Model: {model_id}  Voice: {voice_id}")
    print(f"Chars: {len(text)}")
    print("---")
    print(text)
    print("---")

    audio = elevenlabs_tts(
        text,
        api_key=api_key,
        voice_id=voice_id,
        model_id=model_id,
    )

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_bytes(audio)
    print(f"Wrote {args.out} ({len(audio) // 1024} KB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
