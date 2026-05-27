# Unconventional Thought

Video / documentary production repo for the **Unconventional Thought** channel.

## Layout

| Path | Role |
|------|------|
| [`episodes/`](episodes/README.md) | Per-episode script, audio, transcript, timeline, research |
| [`remotion/`](remotion/README.md) | Shared video compositor (all episodes) |
| [`media_tool/`](media_tool/README.md) | Cue-by-cue media search & acquisition (Next.js); [deploy](media_tool/DEPLOY.md) |
| [`tools/`](tools/) | `build_media_search.py`, `build_remotion_timeline.py`, `voicecut.py`, … |

## Episodes

| Episode | Folder |
|---------|--------|
| 001 — Who Wrote Back in Black | [`episodes/001_WhoWroteBackInBlack/`](episodes/001_WhoWroteBackInBlack/README.md) |
| 002 — Did Bon Scott Know He Was Going to Die? | [`episodes/002_DidBonScottKnowHeWasGoingToDie/`](episodes/002_DidBonScottKnowHeWasGoingToDie/) |

## Quick start

```bash
# Media acquisition UI
cd media_tool && npm install && npm run dev

# Build timeline + render preview (episode 001)
cd remotion
npm run build:timeline
npm run render:preview:low
```

## Git

Large binaries (acquired media, renders, master audio) are **gitignored**. Use local backup or media_tool to restore assets on a fresh clone.
