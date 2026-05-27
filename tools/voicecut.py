#!/usr/bin/env python3
"""
Voicecut: extended SRT where each cue may end with a JSON directive line.

Rules
-----
After the standard SRT index and timestamp line, the subtitle body is one or
more lines. If the LAST non-empty line parses as JSON and starts with '{',
it is the directive; everything above it is spoken text for the cue.

Directive may include optional string fields:
  notes   — producer/editor instructions (continuity, legal, framing, mood).
  prompt  — instruction for an LLM or generative tool when media is TBD or kind=call.

Example block:

  26
  00:01:19,410 --> 00:01:23,690
  And the story we're supposed to accept is...
  {"media": {"kind": "image", "ref": "brian-johnson-newspaper.jpg"}, "effects": ["film_grain", "slow_zoom", "tilt_right"], "transition": "none"}

Commands
--------
  build   <plain.srt> <out.voicecut.srt>   Append default directives to every cue.
  parse   <voicecut.srt> [--json out.json] Parse to a list of cues + directives.
  fill-demo <plain.srt> <out.filled.voicecut.srt> [--json out.json]
            Creative dummy media/effects per cue (storyboard demo; filenames fictional).

Media kinds: image | video | call (call uses \"fn\" + optional \"args\").
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any


_TS = re.compile(
    r"^(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*$"
)


def _ts_to_seconds(h1, m1, s1, ms1, h2, m2, s2, ms2) -> tuple[float, float]:
    def one(h, m, s, ms):
        return int(h) * 3600 + int(m) * 60 + int(s) + int(ms) / 1000.0

    return one(h1, m1, s1, ms1), one(h2, m2, s2, ms2)


def parse_voicecut_srt(path: Path) -> list[dict[str, Any]]:
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()
    cues: list[dict[str, Any]] = []
    i = 0
    n = len(lines)

    while i < n:
        while i < n and not lines[i].strip():
            i += 1
        if i >= n:
            break
        idx_line = lines[i].strip()
        i += 1
        if not idx_line.isdigit():
            raise ValueError(f"expected cue index, got {idx_line!r} near line {i}")
        idx = int(idx_line)
        if i >= n:
            raise ValueError(f"truncated after index {idx}")
        ts_line = lines[i].strip()
        i += 1
        m = _TS.match(ts_line)
        if not m:
            raise ValueError(f"bad timestamp line: {ts_line!r}")
        t0, t1 = _ts_to_seconds(*m.groups())

        body_lines: list[str] = []
        while i < n and lines[i].strip():
            body_lines.append(lines[i])
            i += 1
        while i < n and not lines[i].strip():
            i += 1

        directive: dict[str, Any] | None = None
        subtitle_lines = list(body_lines)
        if body_lines:
            last = body_lines[-1].strip()
            if last.startswith("{") and last.endswith("}"):
                try:
                    directive = json.loads(last)
                    subtitle_lines = body_lines[:-1]
                except json.JSONDecodeError:
                    directive = None

        cues.append(
            {
                "index": idx,
                "start": round(t0, 3),
                "end": round(t1, 3),
                "text": "\n".join(subtitle_lines).strip(),
                "directive": directive,
            }
        )
    return cues


def _default_directive() -> dict[str, Any]:
    return {
        "media": None,
        "effects": [],
        "transition": None,
        "notes": None,
        "prompt": None,
    }


def build_voicecut(
    plain_srt: Path,
    out_path: Path,
    overrides: dict[int, dict[str, Any]] | None = None,
) -> int:
    overrides = overrides or {}
    cues = parse_voicecut_srt(plain_srt)
    for c in cues:
        if c["directive"] is None:
            c["directive"] = overrides.get(c["index"], _default_directive())
    return write_voicecut_srt(cues, out_path)


def write_voicecut_srt(cues: list[dict[str, Any]], out_path: Path) -> int:
    chunks: list[str] = []
    for c in cues:
        h0, rem0 = divmod(c["start"], 3600)
        m0, s0 = divmod(rem0, 60)
        h1, rem1 = divmod(c["end"], 3600)
        m1, s1 = divmod(rem1, 60)
        ts0 = f"{int(h0):02d}:{int(m0):02d}:{s0:06.3f}".replace(".", ",")
        ts1 = f"{int(h1):02d}:{int(m1):02d}:{s1:06.3f}".replace(".", ",")
        chunks.append(str(c["index"]))
        chunks.append(f"{ts0} --> {ts1}")
        if c["text"]:
            chunks.append(c["text"])
        chunks.append(json.dumps(c["directive"], ensure_ascii=False))
        chunks.append("")
    out_path.write_text("\n".join(chunks).rstrip() + "\n", encoding="utf-8")
    return len(cues)


def _norm(t: str) -> str:
    return (
        t.lower()
        .replace("bond scott", "bon scott")
        .replace("bond's", "bon's")
        .replace("bond was", "bon was")
    )


def _cycle(idx: int, items: list[Any]) -> Any:
    return items[idx % len(items)]


def _creative_directive(text: str, idx: int, ctr: dict[str, int]) -> dict[str, Any]:
    """Fictional filenames + stacks for demo / storyboard only (not real files)."""
    t = _norm(text)
    trans_pool = ["film_burn", "none", "broken_film", "light_leak", "flame", "paper_flash"]
    efx_doc = ["film_grain", "paper_texture", "slow_zoom_in"]
    efx_face = ["film_grain", "halftone_soft", "vignette_heavy"]
    efx_stage = ["film_grain", "chromatic_aberration_subtle", "strobe_stage_lights"]
    efx_meta = ["film_grain", "crt_scanlines", "tilt_left"]
    efx_title = ["film_grain", "ken_burns_slow"]

    tr = _cycle(idx, trans_pool)

    def _extras(notes: str | None, prompt: str | None) -> dict[str, Any]:
        x: dict[str, Any] = {}
        if notes:
            x["notes"] = notes
        if prompt:
            x["prompt"] = prompt
        return x

    def img(
        name: str,
        effects: list[str],
        transition: str | None = None,
        *,
        notes: str | None = None,
        prompt: str | None = None,
    ) -> dict[str, Any]:
        return {
            "media": {"kind": "image", "ref": name},
            "effects": effects,
            "transition": transition if transition is not None else tr,
            **_extras(notes, prompt),
        }

    def vid(
        name: str,
        effects: list[str],
        transition: str | None = None,
        *,
        notes: str | None = None,
        prompt: str | None = None,
    ) -> dict[str, Any]:
        return {
            "media": {"kind": "video", "ref": name},
            "effects": effects,
            "transition": transition if transition is not None else tr,
            **_extras(notes, prompt),
        }

    def call(
        fn: str,
        args: dict[str, Any],
        effects: list[str],
        transition: str | None = None,
        *,
        notes: str | None = None,
        prompt: str | None = None,
    ) -> dict[str, Any]:
        return {
            "media": {"kind": "call", "fn": fn, "args": args},
            "effects": effects,
            "transition": transition if transition is not None else tr,
            **_extras(notes, prompt),
        }

    # --- high-signal story beats (order matters: first match wins) ---
    if "ladies and gentlemen" in t or ("jury" in t and "gentlemen" in t):
        return img(
            "courtroom-empty-jury-box-01.jpg",
            efx_doc + ["tilt_right"],
            "film_burn",
            notes="Faceless doc: no jury faces; wide wood + empty seats; high contrast.",
            prompt="1970s courtroom wide shot, empty jury box, warm tungsten, slight wide-angle distortion, documentary grain, no readable faces",
        )
    if "sit down" in t and "hear me out" in t:
        return vid(
            "office-chair-sit-down-silhouette-broll-01.mp4",
            ["film_grain", "slow_push_in"],
            notes="Cut on 'Sit down' beat; keep silhouette only.",
        )
    if "brian johnson" in t:
        ctr["brian"] = ctr.get("brian", 0) + 1
        n = ctr["brian"]
        return img(
            f"brian-johnson-press-clipping-{n:02d}.jpg",
            efx_face + [f"tilt_{'right' if n % 2 else 'left'}"],
            notes="Editorial still or news clipping; avoid non-licensed promo packshots.",
            prompt="Vintage UK tabloid stack, headline about audition, yellow newsprint, macro, 1980, no legible trademark logos",
        )
    if "geordie" in t or "jordy" in t:
        return img("geordie-band-lp-sleeve-generic-1970s-01.jpg", efx_doc + ["slight_rotation_ccw"])
    if "audition" in t and "lyrics" in t:
        return img("legal-pad-handwritten-lyrics-close-01.jpg", efx_doc + ["slow_scroll_up"])
    if "great story" in t and "convenient" in t:
        return vid("studio-audience-laugh-reaction-stock-01.mp4", efx_face + ["flash_frame_subtle"])
    if "thing about" in t and "bon scott" in t:
        ctr["bon"] = ctr.get("bon", 0) + 1
        n = ctr["bon"]
        return img(
            f"bon-scott-live-mic-{n:02d}.jpeg",
            efx_stage + ["slow_zoom_in"],
            notes="Prefer live-stage press still; respect memorial tone if using funeral-adjacent frames elsewhere.",
            prompt="1970s rock singer live, tight on mic and sweat, stage haze, tungsten spots, documentary still, not a modern AI glam portrait",
        )
    if "fingerprint" in t:
        return img("macro-fingerprint-ink-paper-01.jpg", efx_doc + ["extreme_close_up_push"])
    if "nine lives" in t or "9 lives" in t:
        return call(
            "animated_title",
            {"text": "9 LIVES", "subtext": "private metaphor", "style": "neon_flicker", "duration_sec": 1.8},
            efx_title,
            notes="Sting should land on 'nine lives' VO stress; hold 1 beat.",
            prompt="Neon flicker title card: 9 LIVES + subtext 'private metaphor', black matte, subtle film gate weave, 1.8s",
        )
    if "motorcycle" in t or ("accident" in t and "bon" in t):
        return vid("motorcycle-night-highway-b-roll-danger-01.mp4", efx_stage + ["motion_blur_edges"])
    if "funeral" in t or "february 19" in t or "february 1980" in t:
        return img("memorial-flowers-rain-cemetery-wide-01.jpg", ["film_grain", "desaturate_soft", "slow_zoom_out"])
    if "1980" in t and ("calendar" in t or "it's 1980" in t or "it is 1980" in t):
        return img("desk-calendar-1980-january-macro-01.jpg", efx_doc)
    if "back in black" in t and ("album" in t or "title" in t or "track" in t):
        ctr["vinyl"] = ctr.get("vinyl", 0) + 1
        n = ctr["vinyl"]
        return img(f"back-in-black-vinyl-sleeve-atlantic-{n:02d}.jpg", efx_doc + ["ken_burns_corner"])
    if "50 million" in t or "fifty million" in t:
        return call(
            "counter_rush",
            {"end_value": 50000000, "label": "COPIES", "duration_sec": 2.2},
            ["film_grain", "crt_glow"],
            notes="If numbers feel tacky, swap for gold-disc macro instead.",
            prompt="CRT seven-segment counter rushes to 50000000 with label COPIES, phosphor bloom, scanlines, 2.2s",
        )
    if "gold" in t or "platinum" in t:
        return img("riaa-gold-record-wall-blur-01.jpg", efx_face + ["glint_sparkle"])
    if "recording studio" in t or "mixing console" in t or ("console" in t and "meter" in t):
        ctr["studio"] = ctr.get("studio", 0) + 1
        n = ctr["studio"]
        return vid(f"analog-console-vu-meters-peaking-{n:02d}.mp4", efx_stage)
    if "highway to hell" in t:
        return vid("highway-night-lights-driving-pov-01.mp4", efx_stage + ["heat_shimmer"])
    if "big balls" in t:
        return img("chandelier-crystal-ceiling-vintage-01.jpg", efx_doc + ["double_entendre_split_screen_hint"])
    if "swagger" in t or "distilled" in t and "energy" in t:
        return vid("crowd-silhouette-hands-up-stadium-01.mp4", efx_stage)
    if "wrote the lyrics" in t or ("wrote" in t and "lyrics" in t and "black" in t):
        ctr["bon"] = ctr.get("bon", 0) + 1
        n = ctr["bon"]
        return img(f"bon-scott-handwritten-setlist-{n:02d}.jpeg", efx_doc + ["paper_yellow_age"])
    if "prosecution rests" in t or "verdict" in t:
        return call(
            "lower_third",
            {"text": "THE PROSECUTION RESTS", "style": "typewriter_stamp", "duration_sec": 2.8},
            efx_meta,
        )
    if "comments" in t and "verdict" in t:
        return img("youtube-comment-ui-blur-generic-01.jpg", efx_meta)

    # --- softer keyword buckets ---
    if "conspiracy" in t or ("nobody" in t and "talking" in t):
        return img("corkboard-red-string-evidence-wall-01.jpg", efx_doc + ["push_in_slow"])
    if "newspaper" in t or "headline" in t:
        return img("tabloid-headline-stack-macro-01.jpg", efx_doc)
    if "court" in t or "trial" in t:
        return img("courthouse-columns-dusk-01.jpg", efx_doc)
    if "band" in t and ("studio" in t or "walk" in t or "hallway" in t):
        ctr["crowd"] = ctr.get("crowd", 0) + 1
        n = ctr["crowd"]
        return vid(f"band-walking-studio-corridor-{n:02d}.mp4", ["film_grain", "tracking_shot_subtle"])
    if "stage" in t or "concert" in t or "crowd" in t:
        return vid("rock-concert-lights-smoke-generic-01.mp4", efx_stage)
    if "wallet" in t or "buy it" in t:
        return img("wallet-leather-open-empty-01.jpg", efx_face)
    if "side eye" in t or "suspicious" in t or "convenient" in t:
        return vid("macro-eye-suspicious-glance-01.mp4", efx_face)

    # --- rotating B-roll plates (deterministic variety) ---
    plates_img = [
        "archive-paper-texture-fullframe-01.jpg",
        "35mm-film-leader-countdown-frame-01.jpg",
        "microphone-sm58-on-stand-shadow-01.jpg",
        "electric-guitar-body-sunburst-macro-01.jpg",
        "cassette-tape-chrome-shell-01.jpg",
        "neon-arrow-sign-generic-motel-01.jpg",
        "rain-on-window-city-bokeh-01.jpg",
        "vinyl-spinning-top-down-blur-01.jpg",
    ]
    plates_vid = [
        "film-dust-scratch-overlay-loop-01.mp4",
        "paper-shuffle-hands-desk-broll-01.mp4",
        "tape-machine-reels-spinning-close-01.mp4",
    ]
    if idx % 5 == 0:
        return vid(
            plates_vid[idx % len(plates_vid)],
            ["film_grain", "halftone_dots_light", "vignette_soft"],
        )
    fx = ["film_grain", "slow_zoom_in"]
    if idx % 3 != 0:
        fx.append(_cycle(idx, ["tilt_left", "tilt_right"]))
    return img(plates_img[idx % len(plates_img)], fx)


def fill_demo_voicecut(plain_srt: Path, out_path: Path) -> int:
    cues = parse_voicecut_srt(plain_srt)
    ctr: dict[str, int] = {}
    for c in cues:
        c["directive"] = _creative_directive(c["text"], c["index"], ctr)
    return write_voicecut_srt(cues, out_path)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    sub = ap.add_subparsers(dest="cmd", required=True)

    b = sub.add_parser("build", help="Create .voicecut.srt from plain SRT + default JSON per cue")
    b.add_argument("plain_srt", type=Path)
    b.add_argument("out_voicecut", type=Path)
    b.add_argument(
        "--overrides",
        type=Path,
        default=None,
        help="JSON object: {\"26\": {...}, \"27\": {...}} cue index -> directive",
    )

    p = sub.add_parser("parse", help="Parse .voicecut.srt to JSON")
    p.add_argument("voicecut_srt", type=Path)
    p.add_argument("--json", "-o", type=Path, help="Write machine-readable timeline")

    fd = sub.add_parser("fill-demo", help="Creative dummy media/effects for every cue (storyboard demo)")
    fd.add_argument("plain_srt", type=Path)
    fd.add_argument("out_voicecut", type=Path)
    fd.add_argument("--json", "-o", type=Path, default=None, help="Also write parsed JSON timeline")

    args = ap.parse_args()
    if args.cmd == "parse":
        cues = parse_voicecut_srt(args.voicecut_srt)
        data = {"source": str(args.voicecut_srt), "cues": cues}
        if args.json:
            args.json.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
            print("Wrote", args.json.resolve())
        else:
            print(json.dumps(data, indent=2, ensure_ascii=False))
    elif args.cmd == "build":
        ov: dict[int, dict[str, Any]] = {}
        if args.overrides:
            raw = json.loads(args.overrides.read_text(encoding="utf-8"))
            ov = {}
            for k, v in raw.items():
                if isinstance(k, str) and k.startswith("_"):
                    continue
                try:
                    ov[int(k)] = v
                except (TypeError, ValueError):
                    continue
        n = build_voicecut(args.plain_srt, args.out_voicecut, ov)
        print("Wrote", args.out_voicecut.resolve(), "cues:", n)
    elif args.cmd == "fill-demo":
        n = fill_demo_voicecut(args.plain_srt, args.out_voicecut)
        print("Wrote", args.out_voicecut.resolve(), "cues:", n)
        if args.json:
            cues = parse_voicecut_srt(args.out_voicecut)
            data = {"source": str(args.out_voicecut), "cues": cues, "note": "creative dummy media — filenames fictional"}
            args.json.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
            print("Wrote", args.json.resolve())


if __name__ == "__main__":
    main()
