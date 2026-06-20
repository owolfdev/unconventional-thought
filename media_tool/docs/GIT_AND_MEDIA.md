# Git and local media

**Policy:** Git tracks **code + JSON editorial state**. Photos, videos, audio masters, and downloads stay **local** (backup separately).

## What commits

| Path | Commits | Stays local |
|------|---------|-------------|
| `public/media/<episode>/project.json` | ✓ | |
| `public/media/<episode>/m###/acquisition.json` | ✓ | |
| `public/media/<episode>/m###/asset_manifest.json` | ✓ | |
| `public/media/<episode>/m###/acquired/*` | | ✓ all binaries |
| `public/media/<episode>/m###/*` (any non-JSON) | | ✓ e.g. stray JPG in cue folder |
| `public/media/_library/index.json` | ✓ | |
| `public/media/_library/assets/*/meta.json` | ✓ | |
| `public/media/_library/assets/*/*` (binaries) | | ✓ |
| `public/media/_effects/manifest.json` | ✓ | |
| `public/media/_effects/**/*.mp4` etc. | | ✓ re-download with `tools/download_effects_library.py` |
| `public/tmp/*` | | ✓ scratch only |
| `episodes/*/timeline/media_acquisition.json` | ✓ | |
| `episodes/*/audio/vo/**` | | ✓ parts, review renders, archives |
| `episodes/*/graphics/*.png` (small comps) | ✓ optional | |
| `episodes/*/graphics/*.af`, `thumbnail.jpg` | | ✓ |
| `vo_source/**` | | ✓ raw recordings |
| `remotion/out/**` | | ✓ renders |

Root `.gitignore` uses an **allow-list** under `public/media/`: only `*.json`, `.gitkeep`, and `README.md` can be tracked. Anything else dropped into a cue folder is ignored automatically.

## Fresh clone workflow

1. Clone repo (metadata only).
2. Restore media from backup, **or** re-acquire via media_tool.
3. Effects: `python3 tools/download_effects_library.py`
4. Sandbox folders: `python3 tools/bootstrap_sandbox_episode.py`
5. Remotion: `cd remotion && npm run build:timeline`

## Backup (recommended before push / laptop swap)

From repo root:

```bash
rsync -av \
  media_tool/public/media/ \
  /Users/wolf/Backup_TMP/UnconventionalThought/media_tool/public/media/
```

Include episode audio if needed:

```bash
rsync -av episodes/ /Users/wolf/Backup_TMP/UnconventionalThought/episodes/
```

## Before you push

```bash
python3 tools/check_tracked_media.py
```

Should print `OK — no tracked media binaries.` If not:

```bash
python3 tools/check_tracked_media.py --fix
git status   # review untracked-from-index changes, then commit
```

## Already tracked by mistake?

`--fix` runs `git rm --cached` (files stay on disk). Commit that change once; future pushes stay clean.
