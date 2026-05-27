# Episode 001 — Who Wrote Back in Black

Fast-paced faceless documentary. **Start here:**

| You need… | Go to… |
|-----------|--------|
| **Master voiceover** | `audio/master/who_wrote_back_in_black.mp3` |
| **Transcript + word timings** | `transcript/who_wrote_back_in_black.json` |
| **Subtitles (SRT)** | `transcript/who_wrote_back_in_black.srt` |
| **Image search list (historical)** | `timeline/media_search.json` · `.csv` |
| **Edit timeline (media / effects / transitions)** | `timeline/who_wrote_back_in_black.voicecut.srt` |
| **Narration script** | `script/back_in_black_script_v2.txt` |
| **Visual search plan** | `visual/visual_manifest.json` |
| **Downloaded / manual media** | `media/fetch/` · `media/manual/` |
| **Full documentation** | [PROJECT.md](PROJECT.md) |

## Folder map

```
001_WhoWroteBackInBlack/
├── README.md              ← you are here
├── PROJECT.md             ← workflow + provenance
├── script/                ← narration script
├── audio/
│   ├── master/            ← final VO for the episode
│   ├── segments/          ← TTS chunks before assembly
│   └── preview/           ← short test clip (~55s)
├── transcript/            ← Whisper output (master + preview/)
├── timeline/              ← media_search.json (source images) · voicecut (directed edit)
├── edit/                  ← Audacity project
├── visual/                ← beat sheet + fetch manifest
├── media/
│   ├── fetch/             ← API downloads (v01.jpg, credits.json)
│   └── manual/            ← your files + PLACEHOLDER stubs
├── effects/               ← grain / burn reference links
└── _archive/              ← old research notes
```

## Common commands (from repo root)

```bash
# Fetch visuals
python3 tools/fetch_visuals.py episodes/001_WhoWroteBackInBlack/visual/visual_manifest.json

# Rebuild blank voicecut from captions
python3 tools/voicecut.py build \
  episodes/001_WhoWroteBackInBlack/transcript/who_wrote_back_in_black.srt \
  episodes/001_WhoWroteBackInBlack/timeline/who_wrote_back_in_black.voicecut.srt

# Creative demo timeline
python3 tools/voicecut.py fill-demo \
  episodes/001_WhoWroteBackInBlack/transcript/who_wrote_back_in_black.srt \
  episodes/001_WhoWroteBackInBlack/timeline/who_wrote_back_in_black.voicecut.filled.srt

# Remotion preview (from repo root)
cd remotion && npm run build:timeline && npm run render:preview:low
```
