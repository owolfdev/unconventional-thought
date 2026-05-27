# Deploying media_tool (future)

This document describes how **media_tool** will be hosted as a **web app** (phone, tablet, browser) while the rest of the **Unconventional Thought** repo stays on your **desktop** for editing, Remotion renders, and large media.

---

## Split: what goes online vs offline

| Online (hosted `media_tool`) | Offline (local repo) |
|------------------------------|----------------------|
| Search Commons / GIPHY / OpenAI stickers | Remotion preview & full renders (`remotion/`) |
| Download URLs into acquired media | Episode scripts, research, VO master audio |
| Per-cue `acquisition.json` editing | Whisper transcript generation |
| Review workspace UI on mobile | `tools/build_remotion_timeline.py`, `build_media_search.py` |
| Optional: upload from phone camera roll | Audacity / NLE, final export |

**One Git repo** at the project root (`UnconventionalThought/`). You do **not** need a separate git repo for `media_tool` unless you later want independent release cycles.

---

## How deployment works (monorepo subfolder)

```
UnconventionalThought/          ← single GitHub repo, push from /
├── episodes/                   ← not deployed (stays in repo for reference; manifests may be synced)
├── remotion/                   ← not deployed
├── tools/                      ← not deployed
└── media_tool/                 ← **Root Directory** for the host (Vercel, etc.)
```

On each push to your connected branch (e.g. `main`):

1. Git host clones the **whole** repo.
2. Build runs with **working directory** = `media_tool/`.
3. Only the Next.js app is built and served at your public URL.
4. `episodes/` and `remotion/` are ignored by the build unless you add custom steps.

**You do not need `git subtree`** to deploy. Subtree is only for splitting into a second GitHub repo later.

### Optional: deploy only when `media_tool` changes

On Vercel (and similar): **Ignored Build Step** or monorepo path filter, e.g. only build when files under `media_tool/` change. Episode-only commits then skip a redeploy.

---

## Recommended host settings (Vercel example)

| Setting | Value |
|---------|--------|
| **Repository** | `UnconventionalThought` (your GitHub repo) |
| **Root Directory** | `media_tool` |
| **Framework** | Next.js |
| **Build Command** | `npm run build` (default) |
| **Output** | Next default |
| **Install Command** | `npm install` |
| **Node version** | 18+ (match local) |

After connect: assign a domain (e.g. `media.yourdomain.com`).

Other hosts (Railway, Fly.io, self-hosted Node) follow the same idea: run `npm run build` and `npm start` from `media_tool/`.

---

## Environment variables (production)

Set these in the host dashboard — **never** commit `.env.local`.

| Variable | Local (desktop) | Production (hosted) |
|----------|-----------------|---------------------|
| `MEDIA_REPO_ROOT` | `..` (parent = full repo) | TBD — see **Phase 2** below |
| `DEFAULT_MANIFEST_PATH` | `episodes/001_.../timeline/media_search.json` | Same path **if** repo root is available, or API-driven episode list |
| `NEXT_PUBLIC_DEFAULT_MANIFEST_PATH` | Same as above | Same |
| `OPENAI_API_KEY` | `.env.local` | Host secrets |
| `GIPHY_API_KEY` | `.env.local` | Host secrets |
| `YOUTUBE_API_KEY` | optional | optional |
| `GOOGLE_API_KEY` / `GOOGLE_CSE_ID` | optional | optional |
| `WIKIMEDIA_CONTACT` | recommended | **Required** for Commons policy (public URL) |

Copy from `media_tool/.env.example` when creating production env.

---

## Current limitation: local disk only

Today, media_tool assumes:

- **`MEDIA_REPO_ROOT`** points at the full clone.
- Manifests live under `episodes/<id>/timeline/media_search.json`.
- Acquired files are written to **`media_tool/public/media/<episode_id>/m###/acquired/`**.
- Remotion reads the same tree via `remotion/public/media` → symlink to `media_tool/public/media`.

That works on your Mac. A default Vercel deployment **cannot** rely on this layout because:

- Serverless functions have **no persistent disk** (or ephemeral `/tmp` only).
- The full repo may be present at build time, but **uploads and downloads** must go to **object storage** (S3, R2, etc.) in production.
- Episode folders and multi‑GB `acquired/` folders should **not** be deployed as part of the app bundle.

So: you can deploy the **UI shell** early, but **full mobile acquisition** needs **Phase 2** below.

---

## Phased rollout

### Phase 1 — Deploy UI + read-only (optional smoke test)

**Goal:** Public URL opens the app; good for testing layout on mobile.

- Root Directory = `media_tool`.
- Env vars for API keys if you test search/generate.
- Accept that **save to disk** / **create folders** may fail or be no-ops until storage exists.
- Do **not** commit `public/media/**/acquired/*` (already in root `.gitignore`).

### Phase 2 — Production acquisition (required for real use)

**Goal:** Phone/browser can download and select media like desktop.

Planned code changes (not all implemented yet):

1. **Object storage** for `public/media/<episode>/m###/acquired/` (e.g. Cloudflare R2, AWS S3).
2. **API routes** read/write `acquisition.json` and manifests to storage (or DB + storage).
3. **Episode registry** — list episodes and manifest paths without requiring full `MEDIA_REPO_ROOT` on disk.
4. **Auth** (even a simple shared password or magic link) so API keys and write access are not public.
5. **Desktop sync** — script or manual rsync to pull `acquisition.json` + acquired objects back into your local clone for Remotion.

Until Phase 2, keep using **local** `npm run dev` in `media_tool/` for real cue work.

### Phase 3 — Nice-to-haves

- Deploy previews / deep links per cue (`?path=...&item=m022`).
- Webhook or manual “sync to desktop” after a mobile session.
- Separate staging vs production env.

---

## Git & GitHub (repo at `/`)

- **One repository** for the whole project.
- **`.gitignore`** excludes large binaries (`acquired/`, renders, master MP3s).
- **Commit:** `media_tool` source, `acquisition.json`, `asset_manifest.json`, `media_search.json`, scripts.
- **Push** to `main` → can trigger `media_tool` deploy if the project is connected.

```bash
# From repo root (first-time example)
git add .
git commit -m "Prepare media_tool for deploy"
git push origin main
```

Create the GitHub repo in the browser, add `origin`, then push.

---

## What stays on desktop after deploy

| Task | Where |
|------|--------|
| Write / revise scripts | `episodes/<id>/script/` |
| Master VO, Whisper | `episodes/<id>/audio/`, `transcript/` |
| Regenerate `media_search.json` | `python3 tools/build_media_search.py episodes/<id>` |
| Build timeline | `cd remotion && npm run build:timeline` |
| Render episode | `cd remotion && npm run render:preview` |
| Full backup (optional) | rsync whole repo to `Backup_TMP` (see root `AGENTS.md`) |

Workflow loop:

1. **Mobile / web:** acquire and mark media in hosted `media_tool` (after Phase 2).
2. **Desktop:** sync files → rebuild timeline → render in Remotion.

---

## Security checklist (before public URL)

- [ ] All API keys only in host **Secrets**, not in client bundles.
- [ ] `OPENAI_API_KEY`, `GIPHY_API_KEY`, etc. used only in **server** route handlers (current design).
- [ ] Add **auth** before enabling writes in production.
- [ ] Set `WIKIMEDIA_CONTACT` to a real contact URL.
- [ ] Rate-limit or restrict download/upload routes if exposed.

---

## Quick reference

| Question | Answer |
|----------|--------|
| Separate git repo for `media_tool`? | **No** — one repo at `/`. |
| Deploy only `media_tool`? | **Yes** — host **Root Directory** = `media_tool`. |
| Need git subtree? | **No** for deploy; optional later for a split repo. |
| Push at `/` deploys the app? | **Yes**, if the Git project is connected and builds `media_tool`. |
| Can Remotion run on the host? | **Not planned** — render stays local. |
| Ready for full mobile acquisition today? | **Phase 2** (cloud storage + sync) required. |

---

## Related docs

- Local workflow: [`README.md`](README.md)
- Repo layout: [`../episodes/README.md`](../episodes/README.md)
- Remotion (offline): [`../remotion/README.md`](../remotion/README.md)
- Agent / pipeline overview: [`../AGENTS.md`](../AGENTS.md)
