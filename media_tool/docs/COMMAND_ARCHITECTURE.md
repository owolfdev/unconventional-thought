# Command UI architecture

The command-driven media_tool UI (`CommandWorkspace`) is a thin layer over existing
API routes and on-disk acquisition files. This doc describes how to extend it safely.

---

## Data flow (what actually renders)

```
episodes/<id>/timeline/media_search.json     ← manifest (timing, spoken, plan)
media_tool/public/media/<id>/m###/acquisition.json   ← per-cue truth (mode, media, FX)
        ↓  @render rebuilds
remotion/src/timeline.json → preview MP4
```

| Concern | Source of truth |
|---------|-------------------|
| Cue timing, spoken | `media_search.json` |
| **Visual mode, selections, effects** | `acquisition.json` (`resolved_visual_mode`) |
| Remotion render | Per-cue acquisition + timeline builder |

`@mode` and `@effect` save immediately via `PUT /api/acquisition` (disk before UI assumes success).

---

## Code layout

```
src/lib/command/
  directives.ts       Parse `@…` prompt → ParsedDirective (no side effects)
  dispatch.ts         executeDirective(parsed, ctx) — registry / router
  handlers.ts         One handler per command family (IO + messages)
  context.ts          CommandState + CommandActions passed to handlers
  persist-acquisition.ts   Shared PUT /api/acquisition for one cue
  response.ts         Response pane line helpers
  effect-commands.ts  Effect catalog + mutate stack
  mode-commands.ts    Visual mode + @help mode
  render-parse.ts     @render arg parsing
  types.ts            ParsedDirective union, GalleryState, …

src/components/CommandWorkspace.tsx
  React state, keyboard shortcuts, builds CommandContext, calls executePrompt()
```

**Rule:** parsing is pure; handlers mutate via `ctx.actions`; React state lives only in `CommandWorkspace`.

---

## Adding a new `@command`

### 1. Extend the union — `types.ts`

```ts
| { kind: "mycommand"; flag?: string }
```

### 2. Parse it — `directives.ts`

Add a regex branch in `parseDirectiveInput`. Keep `@help` topics as separate `helpTopic` if needed.

### 3. Implement handler — `handlers.ts`

```ts
export async function handleMyCommand(ctx: CommandContext, flag?: string) {
  const cue = requireCueContext(ctx);
  if (!cue) return;
  // …
  ctx.actions.pushLine("Done", "success");
}
```

Use `persistAcquisitionItem()` when changing acquisition (same path as `@effect` / `@mode`).

### 4. Register — `dispatch.ts`

Add a `case` in `executeDirective` calling your handler.

### 5. Document — `directives.ts` `HELP_TEXT` and optionally `@help mytopic`

### 6. Test — `directives.test.ts`

At minimum: one parse test for the new syntax.

---

## Conventions (editorial)

| Topic | Convention |
|-------|------------|
| **Cue 0 / m000** | Preroll title slot — header shows `preroll`, not `0/9` |
| **Content cues** | Header shows `{cue}/{total}` e.g. `1/9` |
| **GIPHY add** | Sticker overlay (`giphy-*.gif`) |
| **Library / download GIF** | Plate media (full frame) unless `giphy-` / `sticker-` prefix |
| **`text_graphic` mode** | Typography only — plates ignored |
| **`effect_only` mode** | Plates + FX — no full-cue typography |
| **`@mode`** | Clears `text_graphic` when leaving typography mode |
| **Effect stack** | `film_grain` + `film_scratches` share one overlay category in timeline builder — only one scratch clip applies |

---

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl/⌘ + `]` | Next cue |
| Ctrl/⌘ + `[` | Previous cue |
| Tab (outside prompt) | Focus prompt |
| Enter | Submit prompt |

---

## Tests

```bash
cd media_tool
npm test
```

Covers directive parsing, cue id normalization, render range parsing, and scrape result parsers (`src/lib/scrape/parse.test.ts`). Add tests when changing parser or cue-id rules.

---

## Search (phase 3)

Command UI `@search google` / `@search video` call Puppeteer scrapers — no Google CSE or YouTube API keys:

| Route | Engine |
|-------|--------|
| `POST /api/scrape/google-images` | Google Images (`tbm=isch`) |
| `POST /api/scrape/bing-images` | Bing Images |
| `POST /api/scrape/youtube` | YouTube results page |

Shared browser: `src/lib/scrape/browser.ts` (one headless Chrome per dev process, tab per request, 1.5s throttle between scrapes).

Uses `puppeteer-extra` + stealth plugin. Chrome resolution order: `SCRAPE_CHROME_PATH` env → system Google Chrome → bundled Chromium (`npm run puppeteer:install`).

**Google CAPTCHA:** Google may block automated image search from some networks. If `GOOGLE_API_KEY` + `GOOGLE_CSE_ID` are set **and** your GCP project still has Custom Search JSON API access, results may fall back to the API; new Google Cloud projects typically get **403** on that API — use `@search library` instead.

---

## Not yet wired (phase 5)

`@cue split`, `@cue merge`, `@use`, `@confirm`, `@cancel` — stubs in `handlePhase5Stub`.

Natural language (phase 4) should call the same handlers via `executeDirective`, not duplicate logic in `CommandWorkspace`.

---

## Related docs

- `docs/COMMAND_SPEC.md` — product spec, full command list
- `docs/GIT_AND_MEDIA.md` — what to commit vs keep local
- `../AGENTS.md` — repo-wide episode pipeline
