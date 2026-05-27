# Effect overlay library

Stock overlay clips for film grain, scratches, burns, light leaks, etc.

## Source lists

URLs are maintained in:

- `001_WhoWroteBackInBlack/effects/effects.md`
- `001_WhoWroteBackInBlack/effects/transitions.md`

## Download

From repo root (requires `yt-dlp`):

```bash
python3 tools/download_effects_library.py
```

Files land in category subfolders, e.g. `_effects/scratches/RG6-qo3qt8A.mp4`.
`manifest.json` records what was downloaded and from which doc.

Re-run skips videos that are already present (by YouTube id).

Served in dev at: `http://localhost:3000/media/_effects/...`
