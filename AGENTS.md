# Agent instructions — UnconventionalThought

**Read this file** at the start of non-trivial work in this repo. It describes how the episode pipeline fits together, where truth lives on disk, and pitfalls that are easy to miss.

For **media_tool / Next.js** specifics, also see `media_tool/AGENTS.md` (Next.js version in this repo may differ from training data).

---

## What this repo is

Documentary-style **YouTube episode production**: VO-driven timing, per-cue media acquisition, and a shared **Remotion** assembly preview (not final grade or legal clearance).

| Area | Path | Role |
|------|------|------|
| Episode assets | `episodes/<id>/` | Script, audio, transcript, timeline, research |
| Media acquisition UI | `media_tool/` | Search/download; `public/media/<episode_id>/m###/` |
| Remotion (shared) | `remotion/` | One compositor for all episodes → `src/timeline.json` |
| Shared tooling | `tools/` | Timeline builder, voicecut, media search generator |

**Episode 001** (`001_WhoWroteBackInBlack`): title **`m000`** (2s pre-roll), tail **`m140`** (2s black). Preview span **m000–m140**; `npm run build:timeline` uses `--max m140`.

---

## End-to-end data flow

```
episodes/<id>/transcript/*.srt + timeline/media_search.json
        ↓
media_tool → public/media/<episode_id>/m###/acquisition.json + acquired/*
        ↓
tools/build_remotion_timeline.py --episode <id> → remotion/src/timeline.json
        ↓
Remotion (ShotClip → MotionMedia) → remotion/out/preview-*.mp4
```

- **Timing source of truth:** `episodes/<id>/timeline/media_search.json`
- **Per-cue editorial state:** `media_tool/public/media/<episode_id>/m###/acquisition.json`
- **Preview settings:** `episodes/<id>/preview-settings.json` (cue overlay toggle)
- **Generated timeline:** `remotion/src/timeline.json` — rebuild after acquisition or `SPECIAL_*` changes

---

## Commands agents commonly run

### Timeline + full preview render

```bash
cd remotion
npm run build:timeline          # --episode 001_WhoWroteBackInBlack --max m140
npm run render:preview:low
npm run render:preview
```

### Single cue or span

```bash
cd remotion
npm run render:cue -- m022
node scripts/render-cues.mjs m026 m027
```

Always **rebuild timeline** before render when `acquisition.json` or `tools/build_remotion_timeline.py` specials changed.

### media_tool

```bash
cd media_tool && npm run dev
```

Default manifest: `episodes/001_WhoWroteBackInBlack/timeline/media_search.json`

### Regenerate media search manifest

```bash
python3 tools/build_media_search.py episodes/001_WhoWroteBackInBlack
```

---

## Per-cue overrides (when media_tool notes are not enough)

Editorial exceptions live in **`tools/build_remotion_timeline.py`** (`SPECIAL_TIMING`, `SPECIAL_MEDIA_DELAY`, `SPECIAL_MEDIA_SCALE`, `SPECIAL_MEDIA_FIT`, `SPECIAL_MOTION`, …).

**Acquisition notes** are parsed in `remotion/src/acquisition-notes.ts`. Prefer notes for repeatable intent; use `SPECIAL_*` for one-off tuning.

---

## Remotion media layout (do not regress)

See prior sections in git history or `remotion/README.md`. Photo/video motion: **`MotionMedia.tsx`** — transforms on the media element, not the frame parent.

Stock overlays: `media_tool/public/media/_effects/`.

---

## Git & large files

- **Commit:** scripts, JSON manifests, `acquisition.json`, Remotion/media_tool source.
- **Do not commit:** `media_tool/public/media/**/acquired/*` (binaries), `remotion/out/`, master MP3s (see `.gitignore`).
- Restore media from local backup (`Backup_TMP`) or re-download via media_tool.

---

## Project backup (rsync)

```bash
rsync -av --delete \
  /Volumes/LACIE_WORK/Development/Projects/UnconventionalThought \
  /Users/wolf/Backup_TMP/
```

After significant pipeline changes, ask the user before running (destructive if path is wrong).

---

## Secrets & git

- **Never commit** `media_tool/.env.local` or API keys.
- **Do not create git commits or push** unless the user explicitly asks.

---

## Where to look for more detail

| Doc | Contents |
|-----|----------|
| `episodes/README.md` | Episode folder layout |
| `episodes/001_WhoWroteBackInBlack/PROJECT.md` | Episode 001 workflow |
| `remotion/README.md` | Render commands |
| `media_tool/README.md` | Acquisition UI (local) |
| `media_tool/DEPLOY.md` | Future web deploy (monorepo subfolder, Phase 1/2) |
| `episodes/001_WhoWroteBackInBlack/timeline/MEDIA_SEARCH_README.md` | Manifest fields |
