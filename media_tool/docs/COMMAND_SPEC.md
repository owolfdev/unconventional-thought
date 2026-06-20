# media_tool — command-driven UI spec

Personal in-house tool. Replaces the form-heavy `ReviewWorkspace` with a single prompt,
response area, cue preview, and media gallery. **All existing API routes and disk layout
are preserved**; this spec defines the new interaction layer only.

---

## Layout (top → bottom)

```
┌─ header (minimal) ─────────────────────────────────────┐
│ m022 · ep 002 · 12/148 · dirty                         │
└────────────────────────────────────────────────────────┘
┌─ cue preview ──────────────────────────────────────────┐
│ spoken · timing · selected plates (sequential preview) │
└────────────────────────────────────────────────────────┘
┌─ response / feedback ──────────────────────────────────┐
│ agent messages · errors · merge prompts · @info dumps  │
└────────────────────────────────────────────────────────┘
┌─ prompt ─────────────────────────────────────────────┐
│ > …                                                    │
│ Enter = submit · Shift+Enter = newline · Tab = focus │
└────────────────────────────────────────────────────────┘
┌─ media gallery ─────────────────────────────────────────┐
│ numbered results from the last search only              │
└─────────────────────────────────────────────────────────┘
```

Header shows only live state. Full detail via `@info`, `@layers`, `@effects`, `@help`.

---

## Input modes

| Mode | Trigger | Handler |
|------|---------|---------|
| **Natural language** | default (no leading `@`) | LLM agent → tool calls |
| **Directive** | line starts with `@` | deterministic parser |
| **Multiline block** | `@cue split:` or `@end`-terminated blocks | parser; see below |

### Keyboard (no mouse required)

| Key | Action |
|-----|--------|
| **Enter** | Submit prompt (normal mode) |
| **Shift+Enter** | Insert newline in prompt |
| **Tab** | Focus prompt input from anywhere |
| **`add 3` / `@add 3`** | Add gallery result #3 (NL or directive) |

Vim keybindings deferred.

---

## Search strategy

### Drop Google/YouTube JSON APIs for in-app search

Remove reliance on `GOOGLE_API_KEY`, `GOOGLE_CSE_ID`, and `YOUTUBE_API_KEY` for
gallery search. Use **Puppeteer** server-side scrapers instead:

| Engine | Route (proposed) | Notes |
|--------|------------------|-------|
| **Google Images** | `POST /api/scrape/google-images` | Scrape `tbm=isch` results → `SearchResult[]` |
| **YouTube** | `POST /api/scrape/youtube` | Scrape results page → video URLs + thumbnails |
| **GIPHY** | existing `/api/giphy/search` | Keep API (stable, no scrape) |
| **Repo library** | existing `/api/library/search` | Separate search; never mixed with Google |

Commons / Openverse remain in codebase but **not in default UI or agent tools**.

### Separate searches (not merged galleries)

- **`@search library …`** → gallery shows **library hits only**
- **`@search google …`** / NL “search google for …” → gallery shows **Google only**
- **`@search gif …`** → GIPHY only
- **`@search video …`** → YouTube (Puppeteer) only

Each search **replaces** the gallery. Numbering is always `1…N` within that result set.

### Puppeteer — safety at our usage level

**Fine for personal, infrequent use** (a few searches every few minutes):

| Concern | At our level |
|---------|----------------|
| **Rate / IP blocks** | Very low risk; add 1–2s delay between scrapes if paranoid |
| **Server load** | One shared headless browser per dev process; close idle tabs |
| **ToS** | Google/YouTube ToS discourage automated access; personal local dev volume is practically invisible — not legal advice |
| **Brittleness** | Selectors break when Google changes DOM; fix on the fly (acceptable for this app) |
| **Deploy** | Dev server only for now; Puppeteer needs Chrome on the machine |

No API keys required for Google/YouTube search after migration.

---

## LLM agent

### Model

- **Routing / NL:** `gpt-4o-mini` (env: `OPENAI_CHAT_MODEL`, default `gpt-4o-mini`)
- **Image gen:** unchanged (`OPENAI_API_KEY`, `gpt-image-1` / `OPENAI_IMAGE_MODEL`)

### Route

`POST /api/agent`

**Request context (system prompt):**

- Current cue: id, spoken, timing, status, visual mode
- Selected media list, effects, transition, notes
- Last gallery: `{ source, query, results[{ index, title, id }] }` (indices 1-based)
- Pending conversation state (e.g. merge awaiting `@use`)

**Response:**

- `{ type: "message", text }` — show in response area
- `{ type: "actions", actions: [...] }` — execute tools, then summarize
- `{ type: "pending", prompt, state }` — e.g. merge content choice

Agent **must not** invent gallery indices; only reference last search results.

---

## `@` directives (deterministic)

Case-insensitive cue ids (`m8` → `m008`). Unknown directive → error in response area.

### Navigation

```
@cue m022              Jump to cue (alias: @m022)
@next                  Next cue
@prev                  Previous cue
@next incomplete       Next cue where status ∉ {complete, text_graphic}
@episode 002           Switch episode manifest
@episodes              List episodes (@episode N to load)
```

After **`@cue merge`**, always land on the **surviving cue** (first id).

### Info (prints to response area)

```
@info                  Cue metadata: spoken, timing, editorial, dates, people, status
@layers                Selected plates + overlays (numbered)
@effects               Show stack on current cue
@effect add <id>       Add effect (saved immediately)
@effect remove <id>    Remove effect
@help effects          Full effect id catalog (@help effect alias)
@status                Acquisition status + visual mode + dirty flag
@episodes              List episodes (load with @episode N)
@help                  Directive list + NL examples
@help effects          Effect id catalog + @effect usage (@help effect alias)
```

### Search (one engine per invocation)

```
@search library <query>
@search google <query>
@search gif <query>
@search video <query>
```

### Gallery actions (last search only)

```
@add <n>               Download + select result n
@preview <n>           Large preview in response area (no download)
```

### Persistence

```
@save                  Write acquisition.json + rollup
@complete              status=complete, save, @next
```

### Generation

```
@generate sticker <prompt>
@generate image <prompt>
@generate title <text>
```

Maps to existing `/api/generate-sticker`, `/api/generate-photo`.

### Effects

```
@effect add <id>       id from effects-catalog (e.g. film_grain)
@effect remove <id>
@transition <id>       id from TRANSITION_IDS; `@transition none` clears
```

### Structural — cue split

**Recommendation: `@end` terminator** (not blank line).

Blank-line termination conflicts with Enter=submit and with split content that may
include intentional empty lines. `@end` is explicit and matches the `@` directive family.

```
@cue split:
Here is the cue
I want to split.
@end
```

**Flow:**

1. User submits `@cue split:` (or `@cue split:` + Shift+Enter + lines + `@end`).
2. Parser collects lines between `@cue split:` and `@end` (trim trailing empty lines only).
3. Each non-empty line → one cue segment (N lines → N cues).
4. Align each line to Whisper word timestamps (reuse `alignSpokenToWords` / `cue-split.ts`).
5. Show **dry-run preview** in response area (ids, spoken, times, renames).
6. Require **`@confirm`** (or NL “yes, split it”) before mutating manifest.

On alignment failure: report which line failed vs transcript; no partial write.

### Structural — cue merge

```
@cue merge m008 m009
```

**Automatic (no prompt):**

- `spoken` = concatenation with single space (VO merge)
- `t_start` = first cue start, `t_end` = second cue end
- Renumber folders / library cue ids (inverse of split)

**Prompt user (response area):**

```
Merging m008 + m009 (VO merged).
Which cue's plates, effects, overlays, and text graphics should I keep?
Reply: @use m008   or   @use m009
```

```
@use m008
```

Copies acquisition fields from chosen cue onto survivor (`m008`). Discards the other cue's
media/effects. Then deletes merged-away cue folder, renames downstream cues, lands on `m008`.

Pending merge state expires after `@cancel` or switching cue without `@use`.

---

## Natural language examples (no `@`)

Handled by agent tools:

| User says | Tool |
|-----------|------|
| “find a gif of bon scott skull” | `search_gif` |
| “search google for rainbow bar sydney 1980” | `search_google` |
| “anything in the library for acdc angus” | `search_library` |
| “add number 2” / “use the third one” | `add_gallery` index=3 |
| “add film grain and vignette soft” | `effect_add` ×2 |
| “generate a sticker of a cracked vinyl record” | `generate_sticker` |
| “mark this complete and go next” | `complete_and_next` |
| “merge m008 and m009, keep m008's media” | `merge_cues` + `use_content` |
| “split this cue at the line break” + pasted lines | `cue_split` (same as `@cue split:`) |

---

## Agent tool schema

```typescript
type AgentTool =
  | { name: "search_library"; query: string }
  | { name: "search_google"; query: string }
  | { name: "search_gif"; query: string }
  | { name: "search_video"; query: string }
  | { name: "add_gallery"; index: number }
  | { name: "preview_gallery"; index: number }
  | { name: "generate_sticker"; prompt: string }
  | { name: "generate_image"; prompt: string }
  | { name: "generate_title"; text: string }
  | { name: "effect_add"; id: string }
  | { name: "effect_remove"; id: string }
  | { name: "transition_set"; id: string | null }
  | { name: "set_status"; status: AcquisitionStatus }
  | { name: "set_note"; text: string }
  | { name: "navigate"; target: "next" | "prev" | "cue"; cueId?: string }
  | { name: "save" }
  | { name: "complete_and_next" }
  | { name: "merge_cues"; firstId: string; secondId: string }
  | { name: "merge_use_content"; cueId: string }
  | { name: "cue_split"; lines: string[] }
  | { name: "confirm_pending" };
```

Each tool wraps an existing lib or API call; no duplicate business logic.

---

## Puppeteer scraper contract

Both scrapers return the existing `SearchResult` shape:

```typescript
interface SearchResult {
  id: string;           // stable for session, e.g. google-<hash>
  title: string;
  url: string;          // direct image URL or YouTube watch URL
  thumbnail_url: string;
  source_page: string;
  license: string;      // "Google — verify rights" / "YouTube — verify rights"
  description?: string;
}
```

**Google Images:** navigate to `https://www.google.com/search?tbm=isch&q=…`, wait for
grid, extract thumbnail + full-size or page link (best effort).

**YouTube:** navigate to `https://www.youtube.com/results?search_query=…`, extract
video id, title, thumbnail (`i.ytimg.com/vi/{id}/hqdefault.jpg`), watch URL.

Shared browser singleton in `src/lib/scrape/browser.ts`. Timeout 30s. Max 20 results.

---

## Implementation phases

| Phase | Deliverable |
|-------|-------------|
| **1** | New shell UI (layout, prompt, response, gallery, Tab focus) |
| **2** | `@` directive parser + `@info` / `@cue` / `@save` / navigation |
| **3** | Puppeteer scrapers + `@search google` / `@search video` |
| **4** | `/api/agent` + NL for search/add/generate/effects |
| **5** | `@cue split:` + `@cue merge` + `@use` + `@confirm` |
| **6** | Retire form panels; optional `?legacy=1` for old UI |

---

## Environment (updated)

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | Agent + image generation |
| `OPENAI_CHAT_MODEL` | Default `gpt-4o-mini` |
| `GIPHY_API_KEY` | GIF search |
| `MEDIA_REPO_ROOT` | Repo root |

**Removed from search path (optional legacy only):** `GOOGLE_API_KEY`, `GOOGLE_CSE_ID`,
`YOUTUBE_API_KEY`.

---

## Open items (post–phase 1)

- Keyboard gallery highlight (`↑/↓`, `Enter` = add) — optional
When render completes, response area shows preview path; video plays in the **render** panel under cue preview.

```
@render 8              Single cue (preview ½ res)
@render 1 2            Cues 1–2 as one mp4
```
- Scraper selector maintenance when Google/YouTube DOM changes
