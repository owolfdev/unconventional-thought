# Media library (`_library/`)

Repo-wide canonical store for reusable photos and videos. New downloads from media_tool go here (not per-cue `acquired/`). Episode 001 legacy `acquired/` folders are unchanged until migrated.

## Layout

```
public/media/_library/
  index.json                 # derived search catalog (regenerated on write)
  assets/
    <16-char-content-hash>/
      meta.json              # source of truth (commit to git)
      bon-scott-live-1979.jpg
```

**Git:** commit `index.json` and each `meta.json`; binaries under `assets/*/` are gitignored (restore from backup or re-download).

## Asset kinds

| `kind` | Examples | Default cue search? |
|--------|----------|-------------------|
| `archive` | Commons, YouTube, uploads | Yes |
| `overlay` | `sticker-*`, `giphy-*`, `title-*` | No |
| `effect` | Film scratches, burns (Phase 5) | No |
| `generated` | Reusable generated assets | Optional |

## Metadata

Each `meta.json` includes:

- **Stable:** `id`, `filename`, `original_filename`, `kind`, `media_type`, `source_url`, `source_engine`, `license`, `tags[]`, `manual_notes`, `archived`
- **Cumulative `usages[]`:** appended when an asset is downloaded for a cue or selected from library search and saved

`search_text` stores all fields combined for reference. At query time, search uses whichever fields you enable (default: filename, tags, notes — not original filename). Pass `fields=filename,tags,notes,original_filename` on `/api/library/assets` and `/api/library/search`.

**Dedup:** content SHA-256 (first 16 hex chars = folder id). Same bytes → one file, merged usages.

**Naming:** auto-names like `download-f6689233be25.jpg` are slugified from title/query on ingest; readable names are kept as-is.

## Phase 1 (current)

- [x] Schema + `index.json` / `meta.json`
- [x] Ingest on URL download, upload, GIPHY, OpenAI sticker/title
- [x] `GET /api/library/search?q=...` (default `kind=archive`)
- [x] Cue **Search** shows library hits first, then external engines
- [x] Selections use `result_id: library:<id>` and `/media/_library/assets/...` URLs
- [x] Saving acquisition syncs library usages for selected assets

## Phase 2

- [x] `tools/migrate_ep001_library.py` — copy ep001 `acquired/` into `_library/` with cue metadata

## Phase 3 (current)

- [x] **`/library`** — browse grid, search, kind filter, archived toggle
- [x] Asset detail panel — edit tags, notes, kind, soft-delete (`archived`)
- [x] Bulk import wizard — multi-file upload with tags/kind/notes
- [x] APIs: `GET /api/library/assets`, `GET|PATCH /api/library/asset/[id]`, `POST /api/library/import`

### API

```bash
# Search library (archive only by default)
curl 'http://localhost:3000/api/library/search?q=bon+scott&limit=20'

# Browse / filter (all kinds)
curl 'http://localhost:3000/api/library/assets?limit=48&offset=0'

# Asset detail
curl 'http://localhost:3000/api/library/asset/b8ccbdb02d5fde6a'

# Update tags / archive
curl -X PATCH 'http://localhost:3000/api/library/asset/b8ccbdb02d5fde6a' \
  -H 'Content-Type: application/json' \
  -d '{"tags":["bon scott","vinyl"],"archived":false}'

# Bulk import (multipart)
curl -X POST 'http://localhost:3000/api/library/import' \
  -F 'files=@photo.jpg' -F 'tags=bon scott, ac/dc' -F 'kind=archive'
```

Downloads (`POST /api/download`) write to the library and auto-select for the current cue.

## Phases not yet done

| Phase | Work |
|-------|------|
| **4** | `build_remotion_timeline.py` — resolve `library:*` paths for episode 002+ |
| **5** | Move `_effects/` into library as `kind: effect` |

## Definition of Done — Phase 1

- [ ] Download image on a cue → file appears under `_library/assets/<id>/`
- [ ] `meta.json` + `index.json` updated; dedup on re-download of same bytes
- [ ] Cue Search returns library matches before Commons/Openverse/Google
- [ ] Selecting library hit + Save adds `library:<id>` to `acquisition.json`
- [ ] Selected media preview plays library URL
- [ ] Overlay kinds (`giphy`, `sticker`, `title`) ingested as `kind: overlay`, excluded from default library search

## Definition of Done — Full library project

- [ ] Ep001 assets copied into library with historical metadata
- [ ] Bulk import UI (folder → tags → commit)
- [ ] Remotion preview/render for ep002+ resolves library paths
- [ ] Effect overlays indexed in library
- [ ] Soft-delete (`archived: true`) hides assets from search

## Commands (Phase 2 migration)

```bash
# From repo root — copy ep001 acquired/ into _library/ (leaves originals in place)
python3 tools/migrate_ep001_library.py
python3 tools/migrate_ep001_library.py --dry-run
```

Review printed dedup report after migration. Restart or refresh media_tool to see updated asset count in header.

Reindex search after bulk tag edits or upgrading search logic:

```bash
python3 tools/reindex_library_search.py
```
