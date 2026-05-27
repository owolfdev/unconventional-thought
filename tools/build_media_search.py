#!/usr/bin/env python3
"""
Build historical media search manifest from transcript SRT.

Editorial rule: documentary about AC/DC / Bon Scott / Brian Johnson — NOT literal
explainer visuals (no jury boxes, office chairs, cork boards for metaphors).

Text graphics ("whitespace"): short or bridge cues use visual_mode=text_graphic
(transcription, pull quote, intertitle) so you are not forced to find another photo.

Artifacts: occasional story-relevant objects (vinyl, cassette, gold record, tour shirt,
tape machine, etc.) — image or video, usually without needing a face on camera.

Outputs:
  timeline/media_search.json
  timeline/media_search.csv

Usage (repo root):
  python3 tools/build_media_search.py episodes/001_WhoWroteBackInBlack
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from pathlib import Path
from typing import Any

_TS = re.compile(
    r"^(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*$"
)


def _norm(t: str) -> str:
    return (
        t.lower()
        .replace("bond scott", "bon scott")
        .replace("bond's", "bon's")
        .replace("bond was", "bon was")
        .replace("jordy", "geordie")
        .replace("ac dc", "ac/dc")
    )


def parse_srt(path: Path) -> list[dict[str, Any]]:
    lines = path.read_text(encoding="utf-8").splitlines()
    cues: list[dict[str, Any]] = []
    i = 0
    n = len(lines)
    while i < n:
        while i < n and not lines[i].strip():
            i += 1
        if i >= n:
            break
        idx = int(lines[i].strip())
        i += 1
        m = _TS.match(lines[i].strip())
        i += 1
        if not m:
            raise ValueError(f"bad timestamp at cue {idx}")
        h1, m1, s1, ms1, h2, m2, s2, ms2 = map(int, m.groups())

        def sec(h, mi, s, ms):
            return h * 3600 + mi * 60 + s + ms / 1000.0

        t0, t1 = sec(h1, m1, s1, ms1), sec(h2, m2, s2, ms2)
        body: list[str] = []
        while i < n and lines[i].strip():
            body.append(lines[i].strip())
            i += 1
        cues.append(
            {
                "cue": idx,
                "t_start": round(t0, 3),
                "t_end": round(t1, 3),
                "spoken": " ".join(body),
            }
        )
    return cues


def _item(
    cue: dict,
    *,
    editorial_intent: str,
    people: list[dict[str, str]],
    situation: str,
    date_from: str = "",
    date_to: str = "",
    location: str = "",
    search_queries: list[str],
    avoid: list[str] | None = None,
    media_type: str = "photo",
    reuse_id: str = "",
    priority: str = "medium",
) -> dict[str, Any]:
    avoid = avoid or ["courtroom", "jury box", "office chair", "cork board", "stock explainer"]
    cid = cue["cue"]
    return {
        "id": f"m{cid:03d}",
        "cue": cid,
        "t_start": cue["t_start"],
        "t_end": cue["t_end"],
        "duration_sec": round(cue["t_end"] - cue["t_start"], 3),
        "spoken": cue["spoken"],
        "visual_mode": "historical",
        "text_graphic": None,
        "artifact": None,
        "editorial_intent": editorial_intent,
        "people": people,
        "situation": situation,
        "date_from": date_from,
        "date_to": date_to,
        "location": location,
        "search_queries": search_queries,
        "avoid": avoid,
        "media_type": media_type,
        "reuse_id": reuse_id,
        "priority": priority,
    }


def _text_graphic_item(
    cue: dict,
    *,
    graphic_type: str,
    display_text: str,
    style: str,
    editorial_intent: str,
    priority: str = "low",
    optional_texture: str = "",
) -> dict[str, Any]:
    """Procedural text beat — no archive search required."""
    cid = cue["cue"]
    tg = {
        "type": graphic_type,
        "text": display_text,
        "style": style,
    }
    if optional_texture:
        tg["optional_texture"] = optional_texture
    return {
        "id": f"m{cid:03d}",
        "cue": cid,
        "t_start": cue["t_start"],
        "t_end": cue["t_end"],
        "duration_sec": round(cue["t_end"] - cue["t_start"], 3),
        "spoken": cue["spoken"],
        "visual_mode": "text_graphic",
        "text_graphic": tg,
        "artifact": None,
        "editorial_intent": editorial_intent,
        "people": [],
        "situation": f"Generated text graphic ({graphic_type})",
        "date_from": "",
        "date_to": "",
        "location": "",
        "search_queries": [],
        "avoid": [],
        "media_type": "generated",
        "reuse_id": "",
        "priority": priority,
    }


def _artifact_item(
    cue: dict,
    *,
    object_name: str,
    story_link: str,
    search_queries: list[str],
    editorial_intent: str,
    media_type: str = "photo",
    date_from: str = "1975",
    date_to: str = "1985",
    priority: str = "medium",
) -> dict[str, Any]:
    """Story-relevant inanimate object — breaks pace without another portrait."""
    cid = cue["cue"]
    return {
        "id": f"m{cid:03d}",
        "cue": cid,
        "t_start": cue["t_start"],
        "t_end": cue["t_end"],
        "duration_sec": round(cue["t_end"] - cue["t_start"], 3),
        "spoken": cue["spoken"],
        "visual_mode": "artifact",
        "text_graphic": None,
        "artifact": {
            "object": object_name,
            "story_link": story_link,
            "media_preference": media_type,
        },
        "editorial_intent": editorial_intent,
        "people": [],
        "situation": f"Inanimate: {object_name}",
        "date_from": date_from,
        "date_to": date_to,
        "location": "",
        "search_queries": search_queries,
        "avoid": ["people faces prominent", "stock explainer", "unrelated product"],
        "media_type": media_type,
        "reuse_id": "",
        "priority": priority,
    }


# Cues that must stay historical photo (people / live) even if short.
_KEEP_PHOTO_FRAGMENTS = (
    "bon scott dies",
    "february 19",
    "funeral",
    "memorial",
    "geordie",
    "highway to hell",
    "live 1979",
    "live 1980",
    "live 1981",
    "brian johnson",
    "back in black tour",
    "shook me all night",
    "hell's bells",
    "hells bells",
    "bon scott",
    "with brian",
    "you've got the narrator",
    "bad reputation",
    "you've got the storytelling",
    "badass woman",
    "you've got the wit",
    "double entendres",
    "tongue firmly planted",
    "swagger",
    "that's a confessional",
    "actual lifestyle",
)

# (spoken substring, object, story_link, queries, media_type)
_ARTIFACT_RULES: list[tuple] = [
    (
        "here goes",
        "reel-to-reel tape machine",
        "Studio transition — analog recording era",
        [
            "reel to reel tape recorder studio 1970s",
            "analog multitrack tape machine close up",
        ],
        "photo",
    ),
    (
        "50 million",
        "gold / platinum award disc",
        "Back in Black sales",
        ["gold record award disc", "platinum album plaque 1980s"],
        "photo",
    ),
    (
        "release back in black",
        "vinyl LP record",
        "Album release 1980",
        ["Back in Black vinyl 1980", "rock album LP sleeve Atlantic"],
        "photo",
    ),
    (
        "newspaper",
        "newspaper front page stack",
        "Press coverage era",
        ["newspaper front page stack 1980", "tabloid newspaper macro 1970s"],
        "photo",
    ),
    (
        "mixing console",
        "analog mixing desk VU meters",
        "Recording Back in Black",
        [
            "analog mixing console VU meters 1970s",
            "recording studio mixing desk close up",
        ],
        "video",
    ),
    (
        "audition",
        "handwritten lyrics legal pad",
        "Audition / writing beat",
        ["handwritten lyrics paper legal pad", "songwriting notebook pencil"],
        "photo",
    ),
    (
        "motorcycle",
        "1970s motorcycle detail",
        "Bon Scott motorcycle accident context",
        ["1970s motorcycle detail chrome", "vintage motorcycle close up 1970s"],
        "photo",
    ),
    (
        "chandelier",
        "crystal chandelier",
        "Big Balls double-entendre object",
        ["crystal chandelier vintage ballroom", "chandelier close up ornate"],
        "photo",
    ),
    (
        "cassette",
        "audio cassette tape",
        "1970s music format",
        ["audio cassette tape 1970s close up", "cassette tape vintage"],
        "photo",
    ),
    (
        "t-shirt",
        "rock band tour t-shirt",
        "Merch / fan culture",
        ["vintage rock tour t-shirt 1970s", "band merchandise t-shirt vintage"],
        "photo",
    ),
]

# Rotating pool for generic bridge beats (story-adjacent rock ephemera).
_ARTIFACT_BRIDGE_POOL: list[dict[str, Any]] = [
    {
        "object": "vinyl record on turntable",
        "story_link": "Rock album culture",
        "queries": ["vinyl record spinning turntable 1970s", "LP record needle drop"],
        "media_type": "photo",
    },
    {
        "object": "audio cassette tape",
        "story_link": "Pre-digital era",
        "queries": ["cassette tape vintage 1980", "audio cassette close up"],
        "media_type": "photo",
    },
    {
        "object": "vintage rock tour t-shirt",
        "story_link": "Tour merch era",
        "queries": ["vintage concert t-shirt 1979", "rock tour merchandise shirt"],
        "media_type": "photo",
    },
    {
        "object": "electric guitar body close-up",
        "story_link": "Rock instrumentation",
        "queries": ["electric guitar body close up sunburst", "Gibson SG guitar detail"],
        "media_type": "photo",
    },
    {
        "object": "vintage microphone on stand",
        "story_link": "Vocal performance object",
        "queries": ["vintage microphone SM58 stand", "stage microphone close up 1970s"],
        "media_type": "photo",
    },
    {
        "object": "guitar amplifier knobs",
        "story_link": "Rock backline",
        "queries": ["guitar amplifier knobs close up", "Marshall amplifier vintage"],
        "media_type": "photo",
    },
    {
        "object": "concert ticket stub vintage",
        "story_link": "Live music culture",
        "queries": ["vintage concert ticket stub", "rock concert ticket 1970s"],
        "media_type": "photo",
    },
    {
        "object": "peeling rock concert poster",
        "story_link": "Gig poster wall",
        "queries": ["peeling concert posters wall", "vintage rock poster torn"],
        "media_type": "photo",
    },
]


# Prefer text graphic when spoken line matches (normalized).
_FORCE_TEXT_FRAGMENTS: list[tuple[str, str, str]] = [
    # (substring, graphic_type, style)
    ("okay, background", "intertitle", "minimal_white"),
    ("personally, i don't buy it", "quote", "typewriter"),
    ("great story. very convenient", "quote", "typewriter"),
    ("the prosecution rests", "title", "blockbuster"),
    ("render your verdict", "quote", "minimal_white"),
    ("we'll come back to that later", "intertitle", "typewriter"),
    ("i'm just asking questions", "quote", "minimal_white"),
    ("totally normal, super common", "quote", "typewriter"),
    ("not even close", "quote", "minimal_white"),
    ("pay attention", "title", "minimal_white"),
]


def _pick_display_text(spoken: str, graphic_type: str) -> str:
    s = spoken.strip()
    if graphic_type == "title" and len(s.split()) <= 4:
        return s.upper().rstrip(".")
    if graphic_type == "quote" and len(s) > 72:
        for sep in (". ", "? ", "! "):
            if sep in s:
                return s.split(sep, 1)[0].strip() + sep.strip()
        return s[:72] + "…"
    return s


def apply_artifact_pass(items: list[dict[str, Any]], max_artifacts: int = 20) -> list[dict[str, Any]]:
    """Assign occasional object beats before text-graphic pass."""
    out: list[dict[str, Any]] = []
    made = 0
    pool_i = 0

    for it in items:
        if it["visual_mode"] != "historical":
            out.append(it)
            continue

        spoken = it["spoken"]
        t = _norm(spoken)

        if any(frag in t for frag in _KEEP_PHOTO_FRAGMENTS):
            out.append(it)
            continue

        if any(frag in t for frag, _, _ in _FORCE_TEXT_FRAGMENTS):
            out.append(it)
            continue

        rule_hit = False
        for frag, obj, link, queries, mtype in _ARTIFACT_RULES:
            if frag in t and it["priority"] != "high":
                out.append(
                    _artifact_item(
                        {
                            "cue": it["cue"],
                            "t_start": it["t_start"],
                            "t_end": it["t_end"],
                            "spoken": spoken,
                        },
                        object_name=obj,
                        story_link=link,
                        search_queries=queries,
                        editorial_intent=(
                            f"Artifact beat: {obj} — story-linked inanimate; "
                            "prefer no faces, tight macro or detail."
                        ),
                        media_type=mtype,
                        date_from=it.get("date_from") or "1975",
                        date_to=it.get("date_to") or "1985",
                        priority=it["priority"],
                    )
                )
                made += 1
                rule_hit = True
                break
        if rule_hit:
            continue

        # Bridge pool: only when we would have reused a still — occasional ephemera
        if (
            made < max_artifacts
            and it["priority"] == "low"
            and it.get("reuse_id")
        ):
            pool = _ARTIFACT_BRIDGE_POOL[pool_i % len(_ARTIFACT_BRIDGE_POOL)]
            pool_i += 1
            out.append(
                _artifact_item(
                    {
                        "cue": it["cue"],
                        "t_start": it["t_start"],
                        "t_end": it["t_end"],
                        "spoken": spoken,
                    },
                    object_name=pool["object"],
                    story_link=pool["story_link"],
                    search_queries=pool["queries"],
                    editorial_intent=(
                        "Occasional ephemera cut — vinyl/cassette/shirt/amp etc.; "
                        "keeps energy without another portrait."
                    ),
                    media_type=pool["media_type"],
                    priority="low",
                )
            )
            made += 1
            continue

        out.append(it)

    return out


def apply_text_whitespace_pass(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Convert eligible bridge cues to text graphics to reduce photo redundancy."""
    out: list[dict[str, Any]] = []
    for it in items:
        spoken = it["spoken"]
        t = _norm(spoken)
        dur = it["duration_sec"]

        if it["visual_mode"] in ("text_graphic", "artifact"):
            out.append(it)
            continue

        if it["priority"] == "high":
            out.append(it)
            continue

        if any(frag in t for frag in _KEEP_PHOTO_FRAGMENTS):
            out.append(it)
            continue

        forced = False
        for frag, gtype, style in _FORCE_TEXT_FRAGMENTS:
            if frag in t:
                out.append(
                    _text_graphic_item(
                        {"cue": it["cue"], "t_start": it["t_start"], "t_end": it["t_end"], "spoken": spoken},
                        graphic_type=gtype,
                        display_text=_pick_display_text(spoken, gtype),
                        style=style,
                        editorial_intent=(
                            f"Whitespace: {gtype} on film grain/black — breaks redundancy; "
                            "no new archive photo needed."
                        ),
                        priority=it["priority"],
                    )
                )
                forced = True
                break
        if forced:
            continue

        # Short punch words / reactions
        words = spoken.split()
        if dur < 1.4 and len(words) <= 2:
            out.append(
                _text_graphic_item(
                    {"cue": it["cue"], "t_start": it["t_start"], "t_end": it["t_end"], "spoken": spoken},
                    graphic_type="title",
                    display_text=_pick_display_text(spoken, "title"),
                    style="minimal_white",
                    editorial_intent="Whitespace: single-word punctuation beat.",
                    priority="low",
                )
            )
            continue

        # Would have reused previous photo — use VO transcription instead
        if it.get("reuse_id") and dur < 4.0:
            out.append(
                _text_graphic_item(
                    {"cue": it["cue"], "t_start": it["t_start"], "t_end": it["t_end"], "spoken": spoken},
                    graphic_type="transcription",
                    display_text=spoken,
                    style="typewriter",
                    editorial_intent=(
                        "Whitespace: show line as kinetic/typewriter transcription over black or grain; "
                        "avoids repeating the previous historical still."
                    ),
                    priority="low",
                )
            )
            continue

        # Medium-length rhetorical without strong archival anchor
        if dur < 3.2 and it["priority"] == "low" and len(words) <= 12:
            if not it["search_queries"] or len(it["people"]) == 0:
                out.append(
                    _text_graphic_item(
                        {"cue": it["cue"], "t_start": it["t_start"], "t_end": it["t_end"], "spoken": spoken},
                        graphic_type="transcription",
                        display_text=spoken,
                        style="typewriter",
                        editorial_intent="Whitespace: transcription card for bridge line.",
                        priority="low",
                    )
                )
                continue

        out.append(it)
    return out


def spec_for_cue(cue: dict, prev_id: str) -> dict[str, Any]:
    t = _norm(cue["spoken"])
    c = cue["cue"]

    # --- opening / thesis ---
    if c == 1 or ("ladies and gentlemen" in t and "jury" in t):
        return _item(
            cue,
            editorial_intent="Rhetorical 'jury' — do NOT show a courtroom. Open on AC/DC at cultural peak (late 70s live) or 1980 press moment.",
            people=[{"name": "AC/DC", "role": "band"}],
            situation="AC/DC live concert performance crowd and stage",
            date_from="1978",
            date_to="1980",
            location="",
            search_queries=[
                "AC/DC live 1979 concert",
                "AC/DC Highway to Hell tour 1979 stage",
                "AC/DC audience 1979",
            ],
            priority="high",
        )
    if "think i'm crazy" in t or "wrong on the facts" in t:
        return _item(
            cue,
            editorial_intent="Reaction beat — use period rock press or fans, not 'confused person' stock.",
            people=[{"name": "AC/DC", "role": "band"}],
            situation="AC/DC press photocall or fans at concert 1979",
            date_from="1979",
            date_to="1980",
            search_queries=["AC/DC press photo 1979", "AC/DC fans concert 1979"],
            reuse_id=prev_id,
            priority="low",
        )
    if "sit down" in t and "hear me out" in t:
        return _item(
            cue,
            editorial_intent="Pacing line — band in studio context, not furniture.",
            people=[{"name": "AC/DC", "role": "band"}],
            situation="AC/DC entering recording studio or group walking corridor 1980",
            date_from="1980",
            date_to="1980",
            location="Bahamas",
            search_queries=[
                "AC/DC Compass Point Studios 1980",
                "AC/DC recording studio 1980",
            ],
            priority="medium",
        )
    if "nobody" in t and "talking about" in t:
        return _item(
            cue,
            editorial_intent="Hidden story beat — contemporary news coverage of Bon Scott death.",
            people=[{"name": "Bon Scott", "role": "vocalist"}],
            situation="Newspaper headlines reporting Bon Scott death February 1980",
            date_from="1980-02",
            date_to="1980-03",
            location="United Kingdom / Australia",
            search_queries=[
                "Bon Scott death newspaper February 1980",
                "Bon Scott obituary 1980",
                "AC/DC Bon Scott dies headline 1980",
            ],
            priority="high",
        )
    if t.strip() in ("here goes.", "here goes"):
        return _artifact_item(
            cue,
            object_name="reel-to-reel tape machine",
            story_link="Transition sting — analog recording era",
            search_queries=[
                "reel to reel tape recorder studio 1970s",
                "analog multitrack tape machine close up",
            ],
            editorial_intent=(
                "Artifact: tape machine macro — no faces; optional brief text overlay in edit."
            ),
            media_type="photo",
            priority="medium",
        )
    if "bon scott wrote" in t and "back in black" in t:
        return _item(
            cue,
            editorial_intent="Core thesis — Bon Scott portrait or live, era-accurate.",
            people=[{"name": "Bon Scott", "role": "vocalist"}],
            situation="Bon Scott performing live with microphone 1978-1979",
            date_from="1978",
            date_to="1979",
            search_queries=[
                "Bon Scott AC/DC live 1979",
                "Bon Scott microphone on stage 1978",
                "Bon Scott concert 1979",
            ],
            priority="high",
        )
    if "i said it" in t or ("whole thing" in t and c < 10):
        return _item(
            cue,
            editorial_intent="Back in Black era — press or live, avoid trademark album cover art if possible.",
            people=[{"name": "AC/DC", "role": "band"}, {"name": "Bon Scott", "role": "vocalist"}],
            situation="AC/DC Back in Black release period press photo or live 1980",
            date_from="1980",
            date_to="1980",
            search_queries=[
                "AC/DC Back in Black 1980 press photo",
                "AC/DC 1980 promotional photograph",
            ],
            avoid=["album cover scan", "courtroom", "office chair"],
            priority="high",
        )
    if "1980" in t and ("facts" in t or "it's 1980" in t):
        return _item(
            cue,
            editorial_intent="Year anchor — period news or studio dated 1980.",
            people=[{"name": "AC/DC", "role": "band"}],
            situation="1980 music press or studio session dated 1980",
            date_from="1980",
            date_to="1980",
            search_queries=["AC/DC 1980 studio", "music magazine 1980 rock"],
            priority="medium",
        )
    if "dead for five months" in t or ("bon scott dies" in t and "1980" in t):
        return _item(
            cue,
            editorial_intent="Bon Scott death — memorial, funeral, or documented public mourning.",
            people=[
                {"name": "Bon Scott", "role": "vocalist", "date_died": "1980-02-19"},
            ],
            situation="Bon Scott funeral or public memorial February 1980 Australia",
            date_from="1980-02",
            date_to="1980-02",
            location="Fremantle, Western Australia",
            search_queries=[
                "Bon Scott funeral February 1980",
                "Bon Scott memorial Fremantle 1980",
                "Bon Scott death 1980 Australia",
            ],
            priority="high",
        )
    if t.strip() == "five." or t.strip() == "five":
        return _item(
            cue,
            editorial_intent="Emphasis — reuse death/memorial visual.",
            people=[{"name": "Bon Scott", "role": "vocalist"}],
            situation="Bon Scott memorial 1980",
            date_from="1980-02",
            date_to="1980-02",
            search_queries=["Bon Scott memorial 1980"],
            reuse_id=prev_id,
            priority="low",
        )
    if "grief" in t or "shell-shocked" in t or ("studio" in t and "new singer" in t):
        return _item(
            cue,
            editorial_intent="Band after Bon — Brian Johnson era begins; group in studio 1980.",
            people=[
                {"name": "AC/DC", "role": "band"},
                {"name": "Brian Johnson", "role": "vocalist"},
            ],
            situation="AC/DC with Brian Johnson recording Back in Black 1980",
            date_from="1980",
            date_to="1980",
            location="Nassau, Bahamas",
            search_queries=[
                "AC/DC Brian Johnson studio 1980",
                "AC/DC Compass Point Studios Brian Johnson 1980",
                "Brian Johnson AC/DC recording 1980",
            ],
            priority="high",
        )
    if "best-selling album" in t or "recorded music" in t:
        return _item(
            cue,
            editorial_intent="Recording achievement — studio session or charts context.",
            people=[{"name": "AC/DC", "role": "band"}],
            situation="AC/DC recording Back in Black at Compass Point Studios 1980",
            date_from="1980",
            date_to="1980",
            search_queries=[
                "AC/DC recording Back in Black 1980 studio",
                "Compass Point Studios AC/DC 1980",
            ],
            priority="high",
        )
    if "50 million" in t or "fifty million" in t:
        return _artifact_item(
            cue,
            object_name="gold / platinum award disc",
            story_link="Back in Black sales milestone",
            search_queries=[
                "gold record award disc close up",
                "platinum album plaque 1980s",
            ],
            editorial_intent="Artifact: sales award object — tight on disc/plaque, not band portrait.",
            date_from="1980",
            date_to="1982",
            media_type="photo",
            priority="medium",
        )
    if "new guy wrote" in t or ("convenient" in t and c < 20):
        return _item(
            cue,
            editorial_intent="Skeptical beat on Brian — portrait or early AC/DC with Brian.",
            people=[{"name": "Brian Johnson", "role": "vocalist"}],
            situation="Brian Johnson portrait early 1980s",
            date_from="1980",
            date_to="1981",
            search_queries=[
                "Brian Johnson 1980 portrait",
                "Brian Johnson AC/DC 1980",
            ],
            priority="medium",
        )
    if "brian johnson" in t and "geordie" in t:
        return _item(
            cue,
            editorial_intent="Pre-AC/DC Brian — Geordie band period.",
            people=[{"name": "Brian Johnson", "role": "vocalist"}, {"name": "Geordie", "role": "band"}],
            situation="Geordie band Brian Johnson 1970s",
            date_from="1973",
            date_to="1978",
            location="UK",
            search_queries=[
                "Geordie band Brian Johnson 1970s",
                "Brian Johnson Geordie live",
            ],
            priority="high",
        )
    if "audition" in t and "lyrics" in t:
        return _item(
            cue,
            editorial_intent="Story beat — Brian joining; studio or candid, not legal pad stock.",
            people=[{"name": "Brian Johnson", "role": "vocalist"}, {"name": "AC/DC", "role": "band"}],
            situation="Brian Johnson joining AC/DC audition period 1980",
            date_from="1980",
            date_to="1980",
            search_queries=[
                "Brian Johnson AC/DC audition 1980",
                "AC/DC new singer 1980",
            ],
            priority="medium",
        )
    if "thing about bon scott" in t or ("fingerprint" in t and "writer" in t):
        return _item(
            cue,
            editorial_intent="Bon as author — candid or performance showing character.",
            people=[{"name": "Bon Scott", "role": "vocalist"}],
            situation="Bon Scott candid photograph 1970s",
            date_from="1974",
            date_to="1979",
            search_queries=[
                "Bon Scott portrait 1970s",
                "Bon Scott AC/DC 1978 photograph",
            ],
            priority="high",
        )
    if "highway to hell" in t:
        return _item(
            cue,
            editorial_intent="Highway to Hell era live — peak Bon Scott stage energy.",
            people=[{"name": "Bon Scott", "role": "vocalist"}, {"name": "AC/DC", "role": "band"}],
            situation="AC/DC Highway to Hell tour live performance 1979",
            date_from="1979",
            date_to="1979",
            search_queries=[
                "AC/DC Highway to Hell tour 1979",
                "Bon Scott Highway to Hell live 1979",
            ],
            priority="high",
        )
    if "big balls" in t or "chandelier" in t:
        return _item(
            cue,
            editorial_intent="Song reference — Bon on stage wit/energy, NOT literal chandeliers.",
            people=[{"name": "Bon Scott", "role": "vocalist"}],
            situation="Bon Scott live performance expressive 1979",
            date_from="1978",
            date_to="1979",
            search_queries=["Bon Scott AC/DC live 1979 stage"],
            avoid=["chandelier", "crystal ball"],
            priority="medium",
        )
    if "motorcycle" in t and "bon" in t:
        return _item(
            cue,
            editorial_intent="Bon Scott motorcycle accident period — historical photos of Bon on bike if available.",
            people=[{"name": "Bon Scott", "role": "vocalist"}],
            situation="Bon Scott motorcycle 1970s",
            date_from="1974",
            date_to="1978",
            search_queries=[
                "Bon Scott motorcycle",
                "Bon Scott motorbike 1970s",
            ],
            priority="high",
        )
    if "nine lives" in t or "cat's eyes" in t:
        return _item(
            cue,
            editorial_intent="Lyric / private metaphor — Bon portrait; optional handwritten lyrics archive.",
            people=[{"name": "Bon Scott", "role": "vocalist"}],
            situation="Bon Scott portrait late 1970s",
            date_from="1977",
            date_to="1979",
            search_queries=[
                "Bon Scott 1978 photograph",
                "Bon Scott AC/DC portrait",
            ],
            priority="high",
        )
    if "take brian johnson" in t or ("love the man" in t and "brian" in t):
        return _item(
            cue,
            editorial_intent="Respect beat — Brian performing with AC/DC, early 80s.",
            people=[{"name": "Brian Johnson", "role": "vocalist"}],
            situation="Brian Johnson singing live AC/DC 1981",
            date_from="1980",
            date_to="1982",
            search_queries=[
                "Brian Johnson AC/DC live 1981",
                "Brian Johnson on stage Back in Black tour",
            ],
            priority="high",
        )
    if "geordie" in t or "go listen to jordy" in t:
        return _item(
            cue,
            editorial_intent="Geordie era comparison.",
            people=[{"name": "Brian Johnson", "role": "vocalist"}, {"name": "Geordie", "role": "band"}],
            situation="Geordie band promotional photo 1970s",
            date_from="1973",
            date_to="1978",
            search_queries=["Geordie band 1975", "Brian Johnson Geordie"],
            priority="high",
        )
    if "not filling bon" in t or "filling bon's shoes" in t:
        return _item(
            cue,
            editorial_intent="Contrast Brian pre-AC/DC vs in AC/DC.",
            people=[{"name": "Brian Johnson", "role": "vocalist"}],
            situation="Brian Johnson Geordie then AC/DC comparison period",
            date_from="1975",
            date_to="1981",
            search_queries=[
                "Brian Johnson Geordie 1976",
                "Brian Johnson AC/DC 1980 live",
            ],
            priority="medium",
        )
    if "slade" in t or "slayed" in t:
        return _item(
            cue,
            editorial_intent="Musical influence reference — UK glam era context photo (Geordie/Slade era).",
            people=[{"name": "Geordie", "role": "band"}],
            situation="UK rock band glam era 1970s promotional",
            date_from="1972",
            date_to="1977",
            search_queries=["Geordie band UK 1975", "Slade band 1973 live"],
            priority="low",
        )
    if "best songs on back in black" in t or "back in black" in t and c > 75 and c < 85:
        return _item(
            cue,
            editorial_intent="Album deep dive — studio or tour 1980-81.",
            people=[{"name": "AC/DC", "role": "band"}],
            situation="AC/DC Back in Black tour live 1981",
            date_from="1980",
            date_to="1981",
            search_queries=[
                "AC/DC Back in Black tour 1981",
                "AC/DC live 1981 Brian Johnson",
            ],
            priority="high",
        )
    if "hell's bells" in t or "hells bells" in t:
        return _item(
            cue,
            editorial_intent="Song title — live performance moment same era.",
            people=[{"name": "AC/DC", "role": "band"}, {"name": "Brian Johnson", "role": "vocalist"}],
            situation="AC/DC performing Hells Bells live early 1980s",
            date_from="1980",
            date_to="1982",
            search_queries=["AC/DC Hells Bells live 1981", "AC/DC live 1980 stage bells"],
            priority="medium",
        )
    if "shook me all night long" in t:
        return _item(
            cue,
            editorial_intent="Iconic song — AC/DC live energy (Bon era archive or early Brian era).",
            people=[{"name": "AC/DC", "role": "band"}],
            situation="AC/DC live concert 1979 or 1981 crowd and stage",
            date_from="1979",
            date_to="1981",
            search_queries=[
                "AC/DC live 1979 audience",
                "AC/DC concert 1981",
            ],
            priority="high",
        )
    if "for those about to rock" in t or "fly on the wall" in t:
        return _item(
            cue,
            editorial_intent="Later Brian era albums — period-accurate promo or live.",
            people=[{"name": "Brian Johnson", "role": "vocalist"}, {"name": "AC/DC", "role": "band"}],
            situation="AC/DC For Those About to Rock era 1981 or Fly on the Wall 1985",
            date_from="1981",
            date_to="1985",
            search_queries=[
                "AC/DC For Those About to Rock 1981",
                "AC/DC Fly on the Wall 1985",
                "Brian Johnson 1980s live",
            ],
            priority="medium",
        )
    if "bon scott wrote those words" in t or "only one explanation" in t:
        return _item(
            cue,
            editorial_intent="Thesis restatement — strong Bon Scott live still.",
            people=[{"name": "Bon Scott", "role": "vocalist"}],
            situation="Bon Scott AC/DC live performance 1979",
            date_from="1978",
            date_to="1979",
            search_queries=["Bon Scott AC/DC live 1979"],
            priority="high",
        )
    if "writing himself into his music" in t or "actual life" in t or "actual voice" in t:
        return _item(
            cue,
            editorial_intent="Biographical montage — Bon Scott life in Australia / early AC/DC.",
            people=[{"name": "Bon Scott", "role": "vocalist"}],
            situation="Bon Scott early career Australia 1970s",
            date_from="1970",
            date_to="1979",
            location="Australia",
            search_queries=[
                "Bon Scott 1974 photograph",
                "Bon Scott Fraternity band 1970s",
                "Bon Scott AC/DC early",
            ],
            priority="high",
        )
    if "fingerprint is on back in black" in t or "bon's fingerprint" in t:
        return _item(
            cue,
            editorial_intent="Visual compare — Bon-era vs Brian-era (two-up or sequential).",
            people=[
                {"name": "Bon Scott", "role": "vocalist"},
                {"name": "Brian Johnson", "role": "vocalist"},
            ],
            situation="Bon Scott and Brian Johnson AC/DC vocalists comparison photos",
            date_from="1979",
            date_to="1981",
            search_queries=[
                "Bon Scott 1979 live",
                "Brian Johnson 1980 AC/DC",
            ],
            priority="high",
        )
    if "absent from everything brian" in t or "before and after" in t:
        return _item(
            cue,
            editorial_intent="Brian discography era — Geordie vs later AC/DC promo shots.",
            people=[{"name": "Brian Johnson", "role": "vocalist"}],
            situation="Brian Johnson Geordie 1970s and AC/DC 1980s promotional photos",
            date_from="1975",
            date_to="1985",
            search_queries=[
                "Brian Johnson Geordie",
                "Brian Johnson AC/DC 1983",
            ],
            priority="medium",
        )
    if "fingerprint puts someone" in t or "bon scott was at the scene" in t:
        return _item(
            cue,
            editorial_intent="Closing metaphor — return to definitive Bon live image, NOT forensic stock.",
            people=[{"name": "Bon Scott", "role": "vocalist"}],
            situation="Bon Scott live on stage definitive photograph 1979",
            date_from="1979",
            date_to="1979",
            search_queries=["Bon Scott AC/DC live 1979 full stage"],
            avoid=["fingerprint macro", "crime scene", "courtroom"],
            priority="high",
        )
    if "prosecution rests" in t or "verdict in the comments" in t:
        return _item(
            cue,
            editorial_intent="Outro rhetoric — AC/DC group shot 1980 or Bon tribute image.",
            people=[{"name": "AC/DC", "role": "band"}],
            situation="AC/DC band group photograph 1980 Brian Johnson era",
            date_from="1980",
            date_to="1981",
            search_queries=["AC/DC band photo 1980", "AC/DC group portrait 1981"],
            priority="medium",
        )
    if "brian johnson is incredible" in t or "heard the interviews" in t:
        return _item(
            cue,
            editorial_intent="Acknowledgment — Brian interview or live still.",
            people=[{"name": "Brian Johnson", "role": "vocalist"}],
            situation="Brian Johnson interview or live 1980s",
            date_from="1980",
            date_to="1990",
            search_queries=["Brian Johnson interview 1980s", "Brian Johnson AC/DC live"],
            priority="low",
        )

    # --- Bon Scott lyrical fingerprint montage (VO lists his writer tics) ---
    if "ever wrote has that same fingerprint" in t or ("same fingerprint" in t and "wrote" in t):
        return _item(
            cue,
            editorial_intent=(
                "Writer identity — Bon with lyrics/paper if archived; else candid pen-in-hand or studio notes."
            ),
            people=[{"name": "Bon Scott", "role": "vocalist"}],
            situation="Bon Scott songwriting lyrics or notebook 1970s",
            date_from="1974",
            date_to="1979",
            search_queries=[
                "Bon Scott handwritten lyrics",
                "Bon Scott writing song lyrics 1970s",
                "Bon Scott AC/DC studio 1979",
            ],
            priority="high",
        )
    if "you've got the narrator" in t:
        return _item(
            cue,
            editorial_intent="First-person lyric voice — Bon addressing crowd, mic in hand, direct presence.",
            people=[{"name": "Bon Scott", "role": "vocalist"}],
            situation="Bon Scott addressing audience or press 1978-1979",
            date_from="1978",
            date_to="1979",
            search_queries=[
                "Bon Scott microphone addressing crowd 1979",
                "Bon Scott press interview speaking 1978",
                "Bon Scott live talking to audience",
            ],
            priority="high",
        )
    if "bad reputation" in t and "proud" in t:
        return _item(
            cue,
            editorial_intent="Outlaw persona — leather, defiant smirk, backstage or street candid; proud troublemaker.",
            people=[{"name": "Bon Scott", "role": "vocalist"}],
            situation="Bon Scott rebellious image photograph 1970s",
            date_from="1975",
            date_to="1979",
            search_queries=[
                "Bon Scott leather jacket photograph 1970s",
                "Bon Scott defiant backstage 1979",
                "Bon Scott bad reputation press photo",
            ],
            priority="high",
        )
    if "you've got the storytelling" in t:
        return _item(
            cue,
            editorial_intent="Narrative songs — Bon animated on stage (gesture, point) or backstage mid-anecdote.",
            people=[{"name": "Bon Scott", "role": "vocalist"}],
            situation="Bon Scott expressive storytelling gesture live 1979",
            date_from="1978",
            date_to="1979",
            search_queries=[
                "Bon Scott AC/DC live stage gesture 1979",
                "Bon Scott animated performance photograph",
                "Bon Scott backstage talking 1970s",
            ],
            priority="high",
        )
    if ("fight" in t and "conquest" in t) or "badass woman" in t:
        return _item(
            cue,
            editorial_intent=(
                "Fight/conquest/women lyric tropes — fierce Bon on stage (snarl, mic thrust, fist) "
                "OR era backstage with female fans; documentary tone, period rock tour, not stock glamour."
            ),
            people=[{"name": "Bon Scott", "role": "vocalist"}],
            situation="Bon Scott aggressive live performance or backstage with fans 1970s",
            date_from="1977",
            date_to="1979",
            search_queries=[
                "Bon Scott aggressive live performance 1979",
                "Bon Scott AC/DC stage snarl microphone",
                "Bon Scott backstage fans 1970s photograph",
                "Bon Scott groupies backstage AC/DC 1979",
            ],
            avoid=["stock model", "modern nightclub", "generic bar stock"],
            priority="high",
        )
    if "you've got the wit" in t or ("wit" in t and "always there" in t):
        return _item(
            cue,
            editorial_intent="Comic writer — Bon laughing, smirk, or mid-joke on stage or in interview.",
            people=[{"name": "Bon Scott", "role": "vocalist"}],
            situation="Bon Scott witty expression laughing 1979",
            date_from="1978",
            date_to="1979",
            search_queries=[
                "Bon Scott smiling live 1979",
                "Bon Scott laughing interview photograph",
                "Bon Scott cheeky grin AC/DC",
            ],
            priority="high",
        )
    if "double entendres" in t or "tongue firmly planted" in t or ("clever rhymes" in t and "puns" in t):
        return _item(
            cue,
            editorial_intent=(
                "Innuendo/wordplay — playful Bon (wink, grin, tongue-in-cheek pose) or Big Balls-era stage wit; "
                "not literal infographic."
            ),
            people=[{"name": "Bon Scott", "role": "vocalist"}],
            situation="Bon Scott playful innuendo performance 1979",
            date_from="1978",
            date_to="1979",
            search_queries=[
                "Bon Scott wink live performance AC/DC",
                "Bon Scott playful stage expression 1979",
                "Bon Scott Big Balls live 1979",
            ],
            avoid=["dictionary", "pun chart", "explainer graphic"],
            priority="high",
        )
    if "swagger" in t and ("bottled energy" in t or "distilled" in t):
        return _item(
            cue,
            editorial_intent=(
                "Pure kinetic Bon — jump, hair, sweat, chaos; definitive high-energy AC/DC live still."
            ),
            people=[{"name": "Bon Scott", "role": "vocalist"}, {"name": "AC/DC", "role": "band"}],
            situation="Bon Scott explosive AC/DC live performance energy 1979",
            date_from="1979",
            date_to="1979",
            search_queries=[
                "Bon Scott jumping live stage 1979",
                "AC/DC Bon Scott live energy photograph 1979",
                "Bon Scott AC/DC concert dynamic 1979",
            ],
            priority="high",
        )
    if "that's a confessional" in t:
        return _item(
            cue,
            editorial_intent="Confessional lyric — intimate Bon portrait (bar, backstage, tired truth-teller).",
            people=[{"name": "Bon Scott", "role": "vocalist"}],
            situation="Bon Scott intimate candid portrait 1970s",
            date_from="1976",
            date_to="1979",
            search_queries=[
                "Bon Scott bar candid 1970s",
                "Bon Scott backstage portrait intimate",
                "Bon Scott Australia candid photograph",
            ],
            priority="high",
        )
    if "actual lifestyle" in t and "grin" in t:
        return _item(
            cue,
            editorial_intent="Lifestyle as lyric — Bon drinking/laughing with mates, zero apology, real 70s rock life.",
            people=[{"name": "Bon Scott", "role": "vocalist"}],
            situation="Bon Scott lifestyle candid Australia pub 1970s",
            date_from="1975",
            date_to="1979",
            location="Australia",
            search_queries=[
                "Bon Scott drinking pub Australia 1970s",
                "Bon Scott grinning candid friends",
                "Bon Scott lifestyle photograph 1970s",
            ],
            avoid=["stock party", "modern bar"],
            priority="high",
        )

    # --- default: era B-roll with person hint from text ---
    people: list[dict[str, str]] = []
    if "bon scott" in t or "bon's" in t:
        people.append({"name": "Bon Scott", "role": "vocalist"})
    if "brian johnson" in t or "brian" in t:
        people.append({"name": "Brian Johnson", "role": "vocalist"})
    if "ac/dc" in t or "back in black" in t:
        people.append({"name": "AC/DC", "role": "band"})

    pname = people[0]["name"] if people else "AC/DC"
    if pname == "AC/DC":
        queries = ["AC/DC 1979 live concert photograph", "AC/DC 1980 press photo band"]
    else:
        queries = [f"{pname} 1979 photograph", f"{pname} AC/DC 1980"]
    return _item(
        cue,
        editorial_intent="Bridge beat — stay on period rock documentary tone; reuse era montage if short.",
        people=people or [{"name": "AC/DC", "role": "band"}],
        situation=f"{pname} historical photograph 1978-1981",
        date_from="1978",
        date_to="1981",
        search_queries=queries,
        reuse_id=prev_id if cue["t_end"] - cue["t_start"] < 2.5 else "",
        priority="low",
    )


def episode_tail_item(last_t_end: float, duration_sec: float = 2.0) -> dict[str, Any]:
    """Post-roll black silence at tail (cue m140 — not in Whisper/SRT)."""
    t_start = last_t_end
    t_end = last_t_end + duration_sec
    return {
        "id": "m140",
        "cue": 140,
        "t_start": t_start,
        "t_end": t_end,
        "duration_sec": duration_sec,
        "spoken": "",
        "visual_mode": "effect_only",
        "text_graphic": None,
        "artifact": None,
        "editorial_intent": (
            "2s black tail after final VO cue — picture hold only; master audio ends "
            "with m139, no VO shift on m001–m139."
        ),
        "people": [],
        "situation": "Black plate (effect-only tail)",
        "date_from": "",
        "date_to": "",
        "location": "",
        "search_queries": [],
        "avoid": [],
        "media_type": "generated",
        "reuse_id": "",
        "priority": "high",
    }


def episode_title_card_item() -> dict[str, Any]:
    """Pre-roll channel card at t=0 (cue m000 — not in Whisper/SRT)."""
    t_end = 2.0
    return {
        "id": "m000",
        "cue": 0,
        "t_start": 0.0,
        "t_end": t_end,
        "duration_sec": t_end,
        "spoken": "",
        "visual_mode": "text_graphic",
        "text_graphic": {
            "type": "transcription",
            "text": "The Unconventional Thought",
            "style": "typewriter",
        },
        "artifact": None,
        "editorial_intent": (
            "Channel id on black + film grain before cold open (m001). "
            "Edit copy in media_tool m000 acquisition. "
            "Pair with SPECIAL_MEDIA_DELAY on m001 so m001 plate does not cover this card."
        ),
        "people": [],
        "situation": "Generated text graphic (title)",
        "date_from": "",
        "date_to": "",
        "location": "",
        "search_queries": [],
        "avoid": [],
        "media_type": "generated",
        "reuse_id": "",
        "priority": "high",
    }


def build(episode_dir: Path) -> dict[str, Any]:
    srt = episode_dir / "transcript" / "who_wrote_back_in_black.srt"
    cues = parse_srt(srt)
    items: list[dict[str, Any]] = []
    prev_id = ""
    for cue in cues:
        item = spec_for_cue(cue, prev_id)
        items.append(item)
        if item.get("visual_mode") == "historical" and not item.get("reuse_id"):
            prev_id = item["id"]

    items = apply_artifact_pass(items)
    items = apply_text_whitespace_pass(items)
    items = [episode_title_card_item(), *items]
    if items:
        last_vo_end = float(items[-1]["t_end"])
        items.append(episode_tail_item(last_vo_end))
    photo_n = sum(1 for i in items if i["visual_mode"] == "historical")
    artifact_n = sum(1 for i in items if i["visual_mode"] == "artifact")
    text_n = sum(1 for i in items if i["visual_mode"] == "text_graphic")

    return {
        "version": 3,
        "episode": episode_dir.name,
        "style": "historical_documentary_not_explainer",
        "source_transcript": "transcript/who_wrote_back_in_black.srt",
        "source_audio": "audio/master/who_wrote_back_in_black.mp3",
        "cue_count": len(items),
        "historical_count": photo_n,
        "artifact_count": artifact_n,
        "text_graphic_count": text_n,
        "notes": (
            "visual_mode: historical (people/era archive), artifact (story-relevant "
            "objects — vinyl, cassette, gold disc, shirt, tape machine, etc.), or text_graphic "
            "(procedural transcription/quote/title). text_graphic.types: transcription | quote | "
            "title | intertitle. Artifacts use search_queries like photos; prefer macro/detail, "
            "faces optional. Downstream: text_graphic → voicecut media.kind=call; artifact/photo → image or video."
        ),
        "items": items,
    }


def write_photos_only_csv(path: Path, data: dict[str, Any]) -> None:
    """Archive search list: historical photos + story artifacts (not text graphics)."""
    sourced = [
        it
        for it in data["items"]
        if it["visual_mode"] in ("historical", "artifact")
    ]
    write_csv(path, {**data, "items": sourced, "cue_count": len(sourced)})


def write_csv(path: Path, data: dict[str, Any]) -> None:
    fields = [
        "id",
        "cue",
        "t_start",
        "t_end",
        "duration_sec",
        "spoken",
        "visual_mode",
        "text_graphic_type",
        "text_graphic_text",
        "text_graphic_style",
        "artifact_object",
        "artifact_story_link",
        "artifact_preference",
        "editorial_intent",
        "people",
        "situation",
        "date_from",
        "date_to",
        "location",
        "search_queries",
        "avoid",
        "media_type",
        "reuse_id",
        "priority",
        "status",
    ]
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for it in data["items"]:
            row = {
                k: it.get(k, "")
                for k in fields
                if k
                not in (
                    "status",
                    "text_graphic_type",
                    "text_graphic_text",
                    "text_graphic_style",
                    "artifact_object",
                    "artifact_story_link",
                    "artifact_preference",
                )
            }
            tg = it.get("text_graphic") or {}
            row["text_graphic_type"] = tg.get("type", "")
            row["text_graphic_text"] = tg.get("text", "")
            row["text_graphic_style"] = tg.get("style", "")
            art = it.get("artifact") or {}
            row["artifact_object"] = art.get("object", "")
            row["artifact_story_link"] = art.get("story_link", "")
            row["artifact_preference"] = art.get("media_preference", "")
            row["people"] = "; ".join(
                f"{p.get('name')}|{p.get('role', '')}" for p in it.get("people", [])
            )
            row["search_queries"] = " | ".join(it.get("search_queries", []))
            row["avoid"] = " | ".join(it.get("avoid", []))
            if it["visual_mode"] == "text_graphic":
                row["status"] = "generated"
            elif it["visual_mode"] == "artifact":
                row["status"] = "artifact"
            else:
                row["status"] = "needed"
            w.writerow(row)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("episode_dir", type=Path, help="e.g. 001_WhoWroteBackInBlack")
    args = ap.parse_args()
    ep = args.episode_dir.resolve()
    data = build(ep)
    out_json = ep / "timeline" / "media_search.json"
    out_csv = ep / "timeline" / "media_search.csv"
    out_photos = ep / "timeline" / "media_search_photos_only.csv"
    out_json.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    write_csv(out_csv, data)
    write_photos_only_csv(out_photos, data)
    sourced_n = data["historical_count"] + data["artifact_count"]
    print(
        f"Wrote {out_json} ({data['cue_count']} cues: "
        f"{data['historical_count']} photos, {data['artifact_count']} artifacts, "
        f"{data['text_graphic_count']} text graphics)"
    )
    print(f"Wrote {out_csv}")
    print(f"Wrote {out_photos} ({sourced_n} rows — photos + artifacts)")


if __name__ == "__main__":
    main()
