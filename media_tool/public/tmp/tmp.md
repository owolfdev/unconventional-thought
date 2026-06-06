Decision 1: One file on disk, or copies everywhere?
Option A — Canonical library + references (recommended)

public/media/_library/
  assets/
    a7f3.../bon-scott-live.jpg    ← stored once
  index.json  (or assets/a7f3.../meta.json)
Cue selection stores library_id (or path). No duplicate bytes.

Option B — Library + copy into cue folder (current mental model)
Library is an index; selecting still copies/symlinks into m###/acquired/ for “this cue’s folder is self-contained.”

Option C — Library only, drop per-cue acquired/
Simplest long-term, but bigger migration and Remotion path changes.

Tradeoff: A is best for reuse and disk space. B is easiest migration (timeline builder may already expect cue-local paths). C is cleanest architecture, most work upfront.

Decision 2: What metadata travels with the asset?
On ingest (download / upload / import from existing acquired/), attach a provenance record:

Field	Source
library_id
hash of file content (dedup) or UUID
source_url
original download URL
source_engine
commons, google, yt-dlp, upload, …
license
from search result or “verify rights”
acquired_at
timestamp
From cue at download time
episode_id
001_WhoWroteBackInBlack
cue_id
m035
spoken
VO line
search_queries[]
what you searched
people[], date_from, situation
from media_search.json
editorial_intent
from manifest
tags[]
derived or manual
Search later: “bon scott 1979 live”, “vinyl”, “Brian Johnson”, people names, episode, cue id, filename.

Open question: Is metadata fixed at first download, or accumulative?
(e.g. m035 tags “Bon live”; later reused on m042 — add m042’s tags too? I’d lean accumulative usage[] plus optional manual tags.)

Decision 3: Dedup
Same URL twice → same file (you already hash URLs for download-f6689233be25.jpg).

Same image, different URLs → content hash (SHA-256 of file) merges duplicates.

Same file, different cues → one library entry, many usage records.

Worth deciding upfront so the library doesn’t balloon.

Decision 4: Scope — global how?
Scope	Pros	Cons
Repo-wide _library/
Reuse ep001 → ep002
Mixes unrelated topics unless tagged well
Per channel (one lib for Unconventional Thought)
Same as above
Fine for one channel
Per episode
Cleaner separation
Less reuse (defeats part of the goal)
For Bon Scott ep002 reusing AC/DC ep001 assets, repo-wide (or channel-wide) library is the right default, with episode + tags for filtering.

Decision 5: What goes in the library?
Not everything needs to be global:

Include	Maybe exclude
Archive photos, video clips
sticker-*.png, giphy-*.gif (cue-specific overlays)
Commons / Google / YouTube downloads
One-off placeholders
Manual uploads
Generated title cards tied to one line
Could use kind: archive | overlay | generated so search defaults to archive when sourcing historical cues.

Decision 6: UX — how do you “re-search” from another cue?
Rough flows:

Library panel on cue page — search box filters _library by metadata; click → add to this cue’s selection (like picking from acquired today).

“Browse library” tab — full-screen grid, filters (people, episode, media type, date).

Suggestions — on m042, auto-suggest library hits matching people / search_queries from manifest (nice later, not v1).

Selection in acquisition.json might become:

{
  "result_id": "library:a7f3...",
  "url": "/media/_library/assets/a7f3.../bon-scott-live.jpg",
  "library_id": "a7f3...",
  ...
}
Decision 7: Migrating episode 001 (~179 files)
One-time index scan:

Walk all */acquired/*
Read sibling asset_manifest.json + acquisition.json for cue context
Content-hash → library entry
Optionally leave files in place initially (index-only migration), then consolidate to _library/ when comfortable
Index-only migration is low risk: no file moves, library is searchable, paths still work until you cut over.

Decision 8: Remotion / timeline builder
build_remotion_timeline.py resolves media from acquisition.json selections and paths under media_tool/public/media/.

Any library path must be:

Stable URL under public/media/_library/..., or
Symlink from cue folder → library (Option B)
Worth checking before moving files — probably a small path-resolution change in the timeline builder.

A concrete v1 I’d suggest
Minimal, useful, not a rewrite:

public/media/_library/ — canonical storage + per-asset meta.json
On every new download — write to library first, then link into cue selection (copy or symlink into acquired/ for backward compat)
Library search API — filter by text across metadata fields
UI — “Search library” block on each cue page above external search
Backfill script — index existing 179 files with cue metadata from manifests
Defer: auto-suggestions, SerpAPI, fancy tagging UI, video transcoding previews.

Questions worth your answers before building
Copy vs reference — OK with one canonical file and cue selections pointing at _library/ (no per-cue copy)?
Scope — one library for the whole repo / channel?
Overlays — exclude stickers/GIPHY/titles from library search by default?
Manual tags — want to add tags/notes on library items outside cue context?
Episode 001 migration — index-only first, or move all files into _library/ immediately?
Search — simple text filter on metadata enough for v1, or need thumbnails grid + filters (people, type, episode)?
Your instinct is right: the siloed m###/acquired/ model is great for “what did I pick for this shot?” but weak for “I know I already downloaded a Bon photo somewhere.” A library with cue-inherited metadata fixes that without throwing away the cue system.

Which of the decisions above matter most to you — especially copy vs reference and what to exclude from the library?