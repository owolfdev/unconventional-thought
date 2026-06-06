# Remotion — shared episode preview

One compositor for all **Unconventional Thought** episodes. Timeline JSON is built per episode via `npm run build:timeline`.

## Active episode

```bash
cd remotion

npm run episode              # show active episode + output folders
npm run episode list         # list 001, 002, …
npm run episode 002          # switch to 002_DidBonScottKnowHeWasGoingToDie
```

Shorthand **`002`** resolves to the folder under `episodes/002_*`.

## Output layout

```
out/render_002/
  m068.mp4              ← full-res full episode (npm run render)
  m001.mp4              ← full-res single cue (npm run render:cue)
  m026-m028.mp4         ← full-res cue span (npm run render:cues)
  preview/              ← half-res assembly checks
    preview-m068.mp4
    preview-m001.mp4
    preview-m026-m028.mp4
  .props/               ← Remotion CLI temp files (gitignored)
```

Episode **001** → `out/render_001/`, etc.

## Workflow

```bash
npm run episode 002
npm run build:timeline       # after acquisition / SPECIAL_* changes
npm run render:preview:cue -- m001
npm run render:cue -- m001
npm run render:preview
npm run render
npm run dev                  # Studio (builds timeline first)
```

## Render commands

| Command | Resolution | Output |
|---------|------------|--------|
| `npm run render:preview` | Half (960×540) | `preview/preview-<maxId>.mp4` |
| `npm run render` | Full (1920×1080) | `<maxId>.mp4` |
| `npm run render:preview:cue -- m001` | Half | `preview/preview-m001.mp4` |
| `npm run render:cue -- m001` | Full | `m001.mp4` |
| `npm run render:preview:cues -- m026-m028` | Half | `preview/preview-m026-m028.mp4` |
| `npm run render:cues -- m026 m027` | Full | `m026-m027.mp4` |

Preview vs full use the **same compositor** — only resolution and output folder differ. Render commands do **not** rebuild the timeline.

`build:timeline` uses the last cue in `media_search.json` as `--max` by default:

```bash
npm run build:timeline -- --max m035
npm run build:timeline -- --episode 001 --max m140
```

## Prerequisites

- Node 18+
- `npm install` in this folder
- Media under `media_tool/public/media/<episode_id>/` or `_library/` refs
- Episode assets under `episodes/<episode_id>/`

## Docs

- Pipeline overview: [`../AGENTS.md`](../AGENTS.md)
