# Episodes

Each numbered folder is one documentary episode: script, research, audio, transcript, timeline manifests, and episode-specific assets.

| Folder | Status |
|--------|--------|
| `001_WhoWroteBackInBlack/` | In production — full pipeline |
| `002_DidBonScottKnowHeWasGoingToDie/` | Script / outline |

## Per-episode layout

```
NNN_Title/
├── episode.json          # id, paths to audio/transcript (optional overrides)
├── preview-settings.json # Remotion cue overlay toggle (001+)
├── script/
├── audio/
├── transcript/
├── timeline/             # media_search.json, voicecut
├── visual/
├── media/                # fetch + manual (episode-local)
├── docs/
└── effects/              # reference links
```

**Not in episode folders:** shared Remotion compositor (`../remotion/`), media_tool acquisition (`../media_tool/public/media/<episode_id>/`), shared `../tools/`.

## Commands

```bash
# Regenerate media search manifest
python3 tools/build_media_search.py episodes/001_WhoWroteBackInBlack

# Build Remotion timeline + render
cd remotion
npm run build:timeline
npm run render:preview
```

media_tool default manifest: `episodes/001_WhoWroteBackInBlack/timeline/media_search.json`
