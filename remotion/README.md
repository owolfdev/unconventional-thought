# Remotion — shared episode preview

One compositor for all **Unconventional Thought** episodes. Timeline JSON is built per episode via `tools/build_remotion_timeline.py --episode <id>`.

## Prerequisites

- Node 18+
- `npm install` in this folder
- Media acquired under `media_tool/public/media/<episode_id>/`
- Episode assets under `episodes/<episode_id>/` (audio, `timeline/media_search.json`)

## Build timeline

```bash
npm run build:timeline
# or: python3 ../tools/build_remotion_timeline.py --episode 001_WhoWroteBackInBlack --max m140
```

Writes `src/timeline.json`. Symlinks `public/media` → media_tool and `public/audio` → active episode audio.

## Preview / render

```bash
npm run dev
npm run render:preview
npm run render:preview:low
npm run render:cue -- m022
node scripts/render-cues.mjs m026 m027
```

Outputs: `out/preview-*.mp4`

## Cue overlay toggle

media_tool writes `episodes/<id>/preview-settings.json` (not in this folder).

## Docs

- Pipeline overview: [`../AGENTS.md`](../AGENTS.md)
- Episode 001: [`../episodes/001_WhoWroteBackInBlack/README.md`](../episodes/001_WhoWroteBackInBlack/README.md)
