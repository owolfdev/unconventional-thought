# Episode 000 — Sandbox

Throwaway episode for **media_tool** command UI testing. Nothing here affects production episodes 001+.

## Load

```
@episode 000
```

Or set manifest path:

`episodes/000_Sandbox/timeline/media_search.json`

## Cues (what to try)

| Cue | Try |
|-----|-----|
| **1** | `@search library …` · gallery Tab · Enter |
| **2** | `@search google …` |
| **3** | `@search gif …` |
| **4** | `@cue split:` (two lines) · `@confirm` (when wired) |
| **5–6** | `@cue merge 5 6` · `@use 5` (when wired) |
| **7** | text graphic — `@complete` without media |
| **8** | effect-only tail |

## Refresh media folders

From repo root:

```bash
python3 tools/bootstrap_sandbox_episode.py
```

Creates `media_tool/public/media/000_Sandbox/m###/` if missing (does not overwrite existing acquisitions).

## Reset

Delete `media_tool/public/media/000_Sandbox/` and re-run bootstrap, or delete individual cue folders.
