# Video studio — architecture & production plan

Living document for the evolution of **media_tool** (+ Remotion + `tools/`) into a **local, universal video production studio**, with **UnconventionalThought** as the first content project.

**Status:** planning / early implementation — no repo split yet. Decisions below are agreed direction unless marked *open*.

---

## Vision

| Today | Target |
|-------|--------|
| Monorepo: content + tools intertwined | **Projects** (content) + **Studio** (tools), separable later |
| UT-specific paths and assumptions | Any project folder opened by the same local app |
| Pipeline starts at media acquisition | Full pipeline: **script → cues → audio → acquire/render** |

The app stays **local-only** (Next.js dev server on the desktop). All paths are real filesystem paths. Web deploy and object storage are **on hold**. A desktop shell (e.g. Tauri) is optional later.

The **mouseless `@` command interface** remains the primary UX. Natural language is a future layer that maps to the same `@` directives (see [Command model](#command-model)).

---

## Project vs studio

### Content project (e.g. UnconventionalThought)

```
MyProject/
├── project.json              ← contract: paths, libraries, defaults
├── episodes/
│   └── 001_Title/
│       ├── episode.json
│       ├── script/
│       │   ├── draft.md          ← pure VO (source of truth)
│       │   ├── cue_map.json      ← editorial cues (script-first)
│       │   └── tagged/
│       │       ├── m001.md       ← ElevenLabs tags per cue
│       │       └── m002.md
│       ├── audio/vo/
│       │   ├── parts/              ← one file per cue (or chunk)
│       │   ├── assembly.json       ← join order, offsets, durations
│       │   └── master.mp3
│       ├── transcript/
│       │   ├── master.srt          ← optional export
│       │   └── master.json         ← whisper words + timestamps
│       ├── timeline/
│       │   └── media_search.json   ← render manifest (from cue build)
│       └── preview-settings.json
├── media/
│   ├── library/                ← primary writable library (downloads)
│   ├── _effects/               ← stock overlays (project-local)
│   └── 001_Title/
│       └── m022/
│           ├── acquisition.json
│           └── acquired/
└── out/                        ← renders (preview + final)
    └── render_001/
```

Content lives **in the project**, not inside the studio app. JSON is tracked in git; media binaries stay local (same policy as today — see `media_tool/docs/GIT_AND_MEDIA.md`).

### Studio (future separate repo; still monorepo for now)

```
video-studio/                   ← future extract target
├── media_tool/                 ← local UI + APIs
├── remotion/                   ← compositor + render
└── tools/                      ← Python CLI (timeline, whisper, elevenlabs, …)
```

Studio opens a project via **`PROJECT_ROOT`** (env, CLI, or UI picker). **`project.json`** defines relative paths inside the project.

---

## `project.json` (draft schema)

```json
{
  "id": "unconventional-thought",
  "name": "Unconventional Thought",
  "version": 1,

  "content": {
    "episodes_dir": "episodes",
    "default_episode": "001_WhoWroteBackInBlack",
    "timeline_manifest": "timeline/media_search.json"
  },

  "media": {
    "cue_root": "media",
    "effects": "media/_effects",
    "libraries": {
      "primary": "media/library",
      "imported": []
    }
  },

  "output": {
    "renders": "out"
  }
}
```

**Libraries:** each project has one **primary** (writable) library. Additional libraries can be **imported** (read-only) from other paths/projects. Asset refs should be library-qualified (e.g. `library:primary/<assetId>`), not a single global `_library`.

---

## UI: one workspace, soft focus

Four pipeline **stages**, one **interface** — not four separate apps.

- Same command bar, episode context, and response log everywhere.
- **Focus** (script | cue | audio | acquire) controls which panel is prominent and what NL defaults to.
- Set with `@section <name>` or inferred from the last command family (`@script …` → script focus).
- Cross-stage commands always work (`@render` from script focus, `@script open` from acquire).

| Focus | Main panel | Typical commands |
|-------|------------|------------------|
| script | Editor | `@script write`, `@script tag`, manual edit |
| cue | Cue map / list | `@cue create`, merge/split, `@cue transcribe`, `@cue build` |
| audio | Chunk list + playback | `@audio create`, `--only m005`, `@audio join` |
| acquire | Gallery + render (today) | `@search`, `@mode`, `@render`, `@add` |

---

## Production flow

Canonical pipeline. Should appear in **`@help flow`** and as a heads-up when scaffolding a **new project** (`@project open` on empty folder).

```
1.  @project open
    → Finder: select or create folder; scaffold layout + episode 001

2.  @script write <prompt>
    → episodes/<id>/script/draft.md  (pure VO — only spoken words)

3.  @cue create
    → LLM proposes script/cue_map.json from draft
    → REVIEW: merge, split, edit boundaries (selection or described sections)

4.  @script tag [cue|selection|all]
    → script/tagged/m00N.md  (ElevenLabs tags — manual or LLM, no rules engine)

5.  @audio create [--only m###]
    → ElevenLabs per cue → parts/ → master.mp3 + assembly.json
    → fails clearly if cue_map.json missing (--auto-cues optional lazy path)

6.  @cue transcribe
    → Whisper on master → transcript/master.json (word-level timing)

7.  @cue build
    → timeline/media_search.json + bootstrap acquisition
    → macro timing from assembly; words mapped from whisper; default text_graphic per cue

8.  @render preview
    → full text-graphic animatic (no media hunt required)

9.  Acquire / polish
    → upgrade individual cues (@mode, @search, @add, effects, …)
    → @render / @render final …
```

### Script rules

- **draft.md** = pure voice-over text (what is said). Source of truth for wording.
- **tagged/m00N.md** = performance layer (`[pause]`, `[quickly]`, etc.). Derived; re-tag after draft edits.
- Tags: **manual or LLM only** — no rule-based tagger.

### Cue rules (script-first)

- Cues are defined **before** audio, not by Whisper segment boundaries.
- **cue_map.json** drives editorial structure, spoken text per `m###`, and ElevenLabs chunking.
- Section boundaries: **editor selection**, described ranges (LLM-assisted), or optional inline markers — not `---` as the primary mechanism.
- **@cue create** is a separate LLM step (not bundled in `@script write`) so the cue map can be reviewed before audio/token spend.
- Merge/split updates cue_map; **re-audio only** when spoken text or tags in affected cues change.

### Whisper role

| Timing | Source |
|--------|--------|
| Cue boundaries (`m###`) | cue_map.json |
| Cue `t_start` / `t_end` | assembly.json (joined parts + gaps) |
| Word-level sync (typewriter, in-cue cuts, @inpoint) | Whisper on master → words mapped into cues by time overlap |

Whisper runs **after audio, before acquire/render**. Display text comes from the script/cue map; timestamps from Whisper (forced alignment / prompt-with-expected-text preferred over replacing script with transcript text).

### Default first render

Every new cue defaults to **`visual_mode: text_graphic`** (typewriter transcription of spoken line). Acquisition **upgrades** cues to photo/video — progressive enhancement, not all-or-nothing production.

---

## Command model

### `@` directives (deterministic)

- Input starting with `@` → `parseDirectiveInput()` → `executeDirective()`.
- Fast, no API cost, exact — for power users and automation.

### Natural language (planned)

- Plain text → LLM interpreter → synthetic `@…` line → **same parser and handlers**.
- Echo mapped directive in the response pane before running.
- Section focus disambiguates script edits vs acquire commands.
- v1: one sentence → one directive. v2: multi-step agent (search then add, etc.).
- Destructive/expensive ops may require existing `@confirm` flow.

Placeholder today: `dispatch.ts` warns *"Natural language agent coming in phase 4"*.

### Project & episode

| Command | Action |
|---------|--------|
| `@project open` | Finder → project root; scaffold if empty |
| `@episode` | List episodes |
| `@episode 002` | Switch active episode |
| `@episode create …` | New episode folder + scaffold |

---

## What already exists in this repo

| Capability | Location | Notes |
|------------|----------|-------|
| Media acquisition + `@` UI | `media_tool/` | Command architecture in `docs/COMMAND_ARCHITECTURE.md` |
| Remotion preview/render | `remotion/` | Shared compositor; `active-episode.json` |
| Timeline builder | `tools/build_remotion_timeline.py` | Episode-specific `SPECIAL_*` overrides |
| ElevenLabs batch VO | `tools/generate_elevenlabs_vo_batch.py` | Chunk on `---`, `--only`, `--join`, `vo_assembly.json` |
| Whisper transcribe | `tools/transcribe_whisper.py` | `.venv_transcribe`; SRT + JSON |
| Media search manifest (ep001) | `tools/build_media_search.py` | Hand-tuned `spec_for_cue` — **not** the generic factory default |
| Sandbox episode | `episodes/000_Sandbox/` | Proves text_graphic + effect paths |
| Project root hint | `media_tool` `MEDIA_REPO_ROOT` | Partial decoupling already |

**Gap:** generic `build_cues_from_cue_map.py` (or equivalent), project.json resolver, script/cue/audio UI, `@project` / `@cue` / `@script` commands, media move to `{project}/media/`.

---

## Migration phasing

| Phase | Goal |
|-------|------|
| **0** | This doc + `@help flow` content (when command UI exists) |
| **1** | `project.json` + path resolver (`PROJECT_ROOT` / `STUDIO_ROOT`) in TS + Python — no file moves |
| **2** | Move acquired media → `{project}/media/`; library rename `_library` → `library` |
| **3** | Script-first pipeline CLI: `@cue create` → tag → audio → transcribe → build → text preview |
| **4** | Wire pipeline into media_tool commands + panels (one workspace, soft focus) |
| **5** | NL interpreter → `@` mapping |
| **6** | Extract studio to separate repo; UT becomes content-only project |

Do **not** split repos before the path contract works inside the monorepo.

---

## Open items (*small*)

- Exact **`cue_map.json`** and **`assembly.json`** field schemas (next doc or implementation task).
- Forced-alignment tooling vs plain Whisper for word ↔ script pairing.
- Whether `@cue build` and `@cue transcribe` merge into one logged command with two phases.
- `@audio create --auto-cues` as optional shortcut vs always requiring `@cue create`.
- Studio state file location (e.g. `{project}/.studio/state.json` for last episode, recent cues).
- Generic LLM cue enrichment (historical vs artifact vs text) — **defer**; not needed for factory default.

---

## Related docs

| Doc | Contents |
|-----|----------|
| `AGENTS.md` | Current monorepo pipeline (episodes + media_tool + remotion) |
| `episodes/README.md` | Per-episode folder layout (today) |
| `media_tool/docs/COMMAND_ARCHITECTURE.md` | Adding `@` commands |
| `media_tool/DEPLOY.md` | Web deploy — **on hold** |
| `episodes/001_…/timeline/MEDIA_SEARCH_README.md` | Manifest fields (visual_mode, text_graphic, …) |

---

## Changelog

| Date | Notes |
|------|-------|
| 2026-06-24 | Initial plan: project/studio split, script-first cues, production flow, command model, phasing |
