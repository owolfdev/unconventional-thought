#!/usr/bin/env python3
"""
Transcribe episode VO with faster-whisper (matches ep001 transcript layout).

Outputs under episodes/<id>/transcript/:
  <basename>.json  — words, segments, metadata
  <basename>.srt   — caption cues
  <basename>.txt   — plain text

Usage (repo root):
  python3 tools/transcribe_whisper.py episodes/002_DidBonScottKnowHeWasGoingToDie \\
    --audio audio/vo/did_bon_scott_know_he_was_going_to_die\\ 2.mp3 \\
    --basename did_bon_scott_know_he_was_going_to_die

Requires: .venv_transcribe at repo root (faster-whisper base).
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]


def _format_srt_time(seconds: float) -> str:
    ms_total = int(round(seconds * 1000))
    hours, rem = divmod(ms_total, 3_600_000)
    minutes, rem = divmod(rem, 60_000)
    secs, ms = divmod(rem, 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{ms:03d}"


def _write_srt(segments: list[dict], path: Path) -> None:
    lines: list[str] = []
    for i, seg in enumerate(segments, start=1):
        lines.append(str(i))
        lines.append(
            f"{_format_srt_time(seg['start'])} --> {_format_srt_time(seg['end'])}"
        )
        lines.append(seg["text"])
        lines.append("")
    path.write_text("\n".join(lines), encoding="utf-8")


def transcribe(
    audio_path: Path,
    out_dir: Path,
    basename: str,
    *,
    model_size: str = "base",
    language: str = "en",
    source_rel: str | None = None,
) -> dict:
    try:
        from faster_whisper import WhisperModel
    except ImportError as e:
        raise SystemExit(
            "faster-whisper not installed. Activate .venv_transcribe:\n"
            "  source .venv_transcribe/bin/activate\n"
            "  pip install faster-whisper"
        ) from e

    out_dir.mkdir(parents=True, exist_ok=True)
    json_path = out_dir / f"{basename}.json"
    srt_path = out_dir / f"{basename}.srt"
    txt_path = out_dir / f"{basename}.txt"

    print(f"Loading faster-whisper {model_size}…")
    model = WhisperModel(model_size, device="auto", compute_type="default")

    print(f"Transcribing {audio_path.name}…")
    segments_iter, info = model.transcribe(
        str(audio_path),
        language=language,
        word_timestamps=True,
        vad_filter=True,
    )

    all_words: list[dict] = []
    seg_list: list[dict] = []
    text_parts: list[str] = []

    for seg in segments_iter:
        words: list[dict] = []
        if seg.words:
            for w in seg.words:
                word = w.word.strip()
                if not word:
                    continue
                obj = {
                    "word": word,
                    "start": round(w.start, 2),
                    "end": round(w.end, 2),
                }
                words.append(obj)
                all_words.append(obj)

        text = seg.text.strip()
        if not text:
            continue

        seg_list.append(
            {
                "start": round(seg.start, 2),
                "end": round(seg.end, 2),
                "text": text,
                "words": words,
            }
        )
        text_parts.append(text)

    rel_source = source_rel or audio_path.name
    payload = {
        "source": rel_source.replace("\\", "/"),
        "model": f"faster-whisper {model_size} (Whisper)",
        "language": info.language,
        "language_probability": round(info.language_probability, 3),
        "duration_seconds": round(info.duration, 3),
        "text": " ".join(text_parts),
        "words": all_words,
        "segments": seg_list,
    }

    json_path.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    _write_srt(seg_list, srt_path)
    txt_path.write_text(payload["text"] + "\n", encoding="utf-8")

    print(f"Wrote {json_path} ({len(seg_list)} segments, {len(all_words)} words)")
    print(f"Wrote {srt_path}")
    print(f"Wrote {txt_path}")
    print(f"Duration: {payload['duration_seconds']:.1f}s")

    return payload


def main() -> None:
    ap = argparse.ArgumentParser(description="Transcribe episode VO with faster-whisper")
    ap.add_argument(
        "episode_dir",
        type=Path,
        help="e.g. episodes/002_DidBonScottKnowHeWasGoingToDie",
    )
    ap.add_argument(
        "--audio",
        type=Path,
        required=True,
        help="Audio path relative to episode dir (or absolute)",
    )
    ap.add_argument(
        "--basename",
        type=Path,
        required=True,
        help="Output basename without extension, e.g. did_bon_scott_know_he_was_going_to_die",
    )
    ap.add_argument("--model", default="base", help="Whisper model size (default: base)")
    ap.add_argument("--language", default="en")
    args = ap.parse_args()

    ep = args.episode_dir.resolve()
    if not ep.is_dir():
        raise SystemExit(f"Episode directory not found: {ep}")

    audio = args.audio if args.audio.is_absolute() else ep / args.audio
    if not audio.is_file():
        raise SystemExit(f"Audio file not found: {audio}")

    basename = args.basename.name if isinstance(args.basename, Path) else str(args.basename)
    if basename.endswith((".json", ".srt", ".txt")):
        basename = Path(basename).stem

    try:
        source_rel = str(args.audio).replace("\\", "/")
        if args.audio.is_absolute():
            source_rel = str(audio.relative_to(ep)).replace("\\", "/")
    except ValueError:
        source_rel = audio.name

    transcribe(
        audio,
        ep / "transcript",
        basename,
        model_size=args.model,
        language=args.language,
        source_rel=source_rel,
    )


if __name__ == "__main__":
    main()
