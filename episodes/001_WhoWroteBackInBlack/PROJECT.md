# Episode 001 — Who Wrote Back in Black (project notes)

See **[README.md](README.md)** for the folder map and quick links.

---

## Audio

| Path | Role |
|------|------|
| `audio/master/who_wrote_back_in_black.mp3` | **Master VO** (~5m 53s) — sync edits to this |
| `audio/segments/who_wrote_bib_*.mp3` | Chunks before assembly |
| `audio/preview/voice.mp3` | Short ElevenLabs-style test (~55s) |
| `edit/who_wrote_back_in_black.aup3` | Audacity project |

**ElevenLabs:** Not configured in this repo. `audio/preview/voice.mp3` was originally an ElevenLabs export (filename in git history). Full master was likely the same voice, assembled from `audio/segments/` in Audacity — confirm in your ElevenLabs account.

---

## Transcript (Whisper)

| Path | Contents |
|------|----------|
| `transcript/who_wrote_back_in_black.json` | Words + segments + timings (source of truth) |
| `transcript/who_wrote_back_in_black.txt` | Plain text |
| `transcript/who_wrote_back_in_black.srt` | 139 caption cues |
| `transcript/preview/voice.json` | Short-clip run (legacy) |

Model: faster-whisper **base** via `.venv_transcribe` at repo root.

---

## Timeline

### Media search (sourcing historical photos)

| Path | Role |
|------|------|
| `timeline/media_search.json` | **139 cues** — people, dates, situations, `search_queries` (not explainer literals) |
| `timeline/media_search.csv` | Same for spreadsheets / downstream search |
| `timeline/MEDIA_SEARCH_README.md` | Field reference |

Regenerate: `python3 tools/build_media_search.py 001_WhoWroteBackInBlack`

Old explainer-style demo: `_archive/timeline_demo_v1/`

### Voicecut (directed edit)

| Path | Role |
|------|------|
| `timeline/who_wrote_back_in_black.voicecut.srt` | Per-cue `media` / `effects` / `transition` after files exist |
| `timeline/*.voicecut.json` | Parsed timelines |

Schema: `tools/voicecut_schema.json` · CLI: `tools/voicecut.py`

---

## Visual

| Path | Role |
|------|------|
| `visual/visual_script.md` | Human beat sheet |
| `visual/visual_manifest.json` | Per-cue queries + providers (`episode_root`: `..`) |
| `media/fetch/` | Downloaded slots (`v01.jpg`, `credits.json`) |
| `media/manual/` | Curated assets + `PLACEHOLDER.jpg` / `.mp4` |
| `effects/` | Reference links for grain, burns, overlays |

Fetcher: `python3 tools/fetch_visuals.py 001_WhoWroteBackInBlack/visual/visual_manifest.json`

---

## Script

`script/back_in_black_script_v2.txt` — full narration with performance tags.

---

## Workflow

1. Write / revise **script/**
2. Generate VO → **audio/segments/** → assemble in **edit/** → export **audio/master/**
3. Whisper → **transcript/**
4. Direct in **timeline/** voicecut (use **transcript/*.srt** as timing base)
5. Source **media/** via manifest + manual folder
6. Cut in NLE to master audio + voicecut + fetched media

---

## Repo tools (`tools/`)

| Tool | Purpose |
|------|---------|
| `fetch_visuals.py` | Commons / Unsplash / Pexels / local / placeholder |
| `voicecut.py` | `build` · `parse` · `fill-demo` |

Python venv: `.venv_transcribe` (transcription only).
