# Media search manifest

Historical documentary sourcing + **occasional story objects** (vinyl, cassette, gold disc, tour shirt) + **text graphic whitespace** so you are not hunting for a new photo on every line.

## Files

| File | Use |
|------|-----|
| **`media_search.json`** | Full structure (v3) — automation input |
| **`media_search.csv`** | Flat export for Sheets |
| **`media_search_photos_only.csv`** | Archive search subset — **photos + artifacts** (no text graphics) |
| **`who_wrote_back_in_black.voicecut.srt`** | Optional edit timeline after assets exist |

Archived explainer demo: **`../_archive/timeline_demo_v1/`**

## Regenerate

```bash
python3 tools/build_media_search.py episodes/001_WhoWroteBackInBlack
```

Prepends **`m000`** (episode title card, 2s at t=0) and appends **`m140`** (2s black tail after last VO) — neither from SRT.

## `visual_mode`

| Mode | Meaning |
|------|---------|
| **`historical`** | Archive of people, era, events — use `search_queries`, `people`, dates; pair with **photo** or **video** in acquisition |
| **`stock`** | Generic / licensed B-roll (not story-specific archive); pair with **photo** or **video** |
| **`artifact`** | Story-relevant **object** (vinyl, cassette, gold disc, tape machine, tour shirt, legal pad, etc.) — photo or video; prefer macro/detail, faces optional |
| **`text_graphic`** | **No photo** — render typography in the edit (transcription, quote, title) |
| **`effect_only`** | No acquired file — effects on black plate |

Legacy manifests may still say `historical_photo`; media_tool normalizes that to `historical` on load/save.

### Text graphic types (`text_graphic.type`)

| Type | When to use | Example |
|------|-------------|---------|
| **`transcription`** | VO line on screen (typewriter / kinetic) | Bridge lines that would otherwise repeat a still |
| **`quote`** | Pull-quote emphasis | “Personally, I don't buy it.” |
| **`title`** | Short punch | `FIVE.` · `HERE GOES` |
| **`intertitle`** | Section break | `OK, BACKGROUND` |

### Styles (`text_graphic.style`)

`typewriter` · `minimal_white` · `blockbuster` · `newspaper` (suggested in editor)

Often composite over **film grain** or black — not a literal explainer slide deck.

## Historical / stock fields

**Historical** cues use: `people`, `situation`, `date_from`, `date_to`, `search_queries`, `avoid`.

**Stock** cues use the same search fields; editorial intent should describe generic B-roll, not a specific archive moment.

## Artifact fields (`artifact`)

| Field | Meaning |
|-------|---------|
| **`object`** | What to show (e.g. vinyl LP, cassette, gold award disc) |
| **`story_link`** | Why it fits this beat |
| **`media_preference`** | `photo` or `video` |

Use the same `search_queries` / Commons workflow as photos. Good for breaking up portrait-heavy runs without metaphor B-roll.

## Map to voicecut (after render)

**Photo:**
```json
{"media": {"kind": "image", "ref": "bon-scott-live-1979.jpg"}, "effects": ["film_grain"], "transition": "film_burn"}
```

**Artifact (object still or clip):**
```json
{"media": {"kind": "image", "ref": "vinyl-turntable-1970s.jpg"}, "effects": ["film_grain"], "transition": "cut"}
```

**Text graphic:**
```json
{
  "media": {
    "kind": "call",
    "fn": "text_graphic",
    "args": {"type": "transcription", "text": "Fine. Doesn't matter.", "style": "typewriter"}
  },
  "effects": ["film_grain"],
  "transition": "none"
}
```

## Downstream photo search only

```bash
python3 tools/build_media_search.py episodes/001_WhoWroteBackInBlack
# then filter CSV where visual_mode is historical_photo or artifact
```

Or use **`media_search_photos_only.csv`** (written on each build).
