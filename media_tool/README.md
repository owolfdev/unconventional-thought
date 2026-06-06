# media_tool

Next.js UI for acquiring visuals from a generated `media_search.json`, organized
**per cue** on disk.

media_tool is meant to turn an episode media plan into usable local assets. For
each cue (`m001`, `m002`, etc.) you can review the shot intent, search archives,
download image/video URLs, inspect the acquired folder, and mark the files that
should be used for that shot.

## Setup

```bash
cd media_tool
cp .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Future hosting (Vercel, mobile):** see **[DEPLOY.md](DEPLOY.md)** — one Git repo at `/`, deploy only the `media_tool/` folder; Remotion and renders stay on desktop.

The default manifest is:

`episodes/001_WhoWroteBackInBlack/timeline/media_search.json`

You can load another manifest from the path input at the top of the app.

## Daily Workflow

1. **Load** a manifest.
2. Click **Create media folders**. This creates one folder per cue under
   `public/media/<project>/`.
3. Review the current cue: spoken line, editorial intent, dates, people,
   artifact notes, and avoid list.
4. Use the search query rows to search Commons, Openverse, Google Images, or
   YouTube.
5. Select useful search results, or use the bottom **Download** section:
   - **Generate with OpenAI** — sticker or title overlay (transparent PNG →
     `acquired/`, auto-selected). Needs `OPENAI_API_KEY` in `.env.local`.
   - **GIPHY sticker** — search and import animated GIFs as `giphy-*.gif` (same
     Remotion sticker layer). Needs `GIPHY_API_KEY` in `.env.local`.
   - **Image URL** downloads a direct image URL.
   - **Video URL** downloads a YouTube or direct video URL.
   - **Pick from computer** copies a local image/video/audio file into acquired/.
6. While reviewing a cue, the **Selected media preview** at the top plays your
   selections **in sequence** over the cue’s duration (equal time per clip when
   multiple are selected). Click thumbnails to jump; Pause/Play to hold a frame.
7. Click **Open acquired/** to view the media already downloaded for the current
   cue.
8. On the acquired media page, click the check mark on the file(s) you want for
   that shot. Checked files are written into that cue's `acquisition.json` as
   selected media.
9. Return to the main app, adjust status/effects/notes if needed, then click
   **Save settings** or **Complete & next**.

**Remotion cue labels:** use the toggle at the top (**Remotion cue labels: ON/OFF**)
to burn in cue number + media id (`m022`) on each shot in the Remotion preview.
Updates `remotion/src/preview-settings.json` (refresh Remotion Studio after toggling).

**Navigation:** **Previous** / **Next** move one cue at a time. **Shift+click**
either button to jump to the previous or next cue that is still incomplete
(status not `complete` or `text_graphic`).

## Media library

New downloads go to the repo-wide library at `public/media/_library/` (not per-cue `acquired/`). Cue search shows library matches first. See **[docs/LIBRARY.md](docs/LIBRARY.md)**.

## Folder layout

After **Create media folders**:

```
public/media/001_WhoWroteBackInBlack/
  project.json
  m001/
    asset_manifest.json   # what this cue needs (from media_search)
    acquisition.json      # selections, notes, status (saved from UI)
    acquired/             # drop downloaded photos/videos here
      .gitkeep
  m002/
    ...
```

Downloaded files are served directly under:

`/media/001_WhoWroteBackInBlack/m001/acquired/<filename>`

The browseable acquired-media page is:

`/acquired/001_WhoWroteBackInBlack/m001`

Episode-level rollup still written to:

`001_WhoWroteBackInBlack/timeline/media_acquisition.json`

## What Gets Written

media_tool writes four kinds of files:

- `public/media/<project>/project.json` - project index.
- `public/media/<project>/<id>/asset_manifest.json` - cue-level requirements,
  effects, target status, and acquired file list.
- `public/media/<project>/<id>/acquisition.json` - cue-level selections, notes,
  status, resolved visual mode, effects, and transition.
- `<episode>/timeline/media_acquisition.json` - episode-level acquisition rollup.

When you check a file on `/acquired/<project>/<id>`, that local file is added to
the cue's `acquisition.json` as selected media with a URL like:

`/media/<project>/<id>/acquired/<filename>`

## Search Engines

The search rows support:

- **Wikimedia Commons** - in-app gallery.
- **Openverse** - in-app gallery for CC-licensed images.
- **Google Images** - in-app gallery returns **direct image URLs** via Google
  Custom Search API when `GOOGLE_API_KEY` + `GOOGLE_CSE_ID` are set in
  `.env.local` (see `.env.example`). Without keys, Search shows setup instructions
  — use Openverse engine for CC images, or Open in browser ↗ + paste URL.
- **YouTube** - in-app gallery when `YOUTUBE_API_KEY` is configured; otherwise
  use **Open in browser** and paste the chosen video URL into **Video URL**.
- **Google (web)** - opens in browser; paste a useful URL manually.

## Downloads

Use the bottom **Download** section on each cue page.

- Paste direct image URLs into **Image URL**.
- Paste YouTube or direct video URLs into **Video URL**.
- Downloads are saved to `public/media/<project>/<id>/acquired/`.
- The acquired media page shows previews and lets you mark which files are
  selected for the shot.

### yt-dlp (YouTube)

```bash
brew install yt-dlp
```

Restart `npm run dev` after installing. The header shows whether `yt-dlp` is on
PATH.

You can verify it manually:

```bash
yt-dlp --version
```

## Cue Settings

Each cue can be adjusted before saving:

- **Visual mode**: `historical`, `stock`, `artifact`, `text_graphic`, or
  `effect_only` (editorial category — e.g. historical + video, stock + photo).
- **Media type**: `photo`, `video`, or `generated` (file format / render type).
- **Status**: `pending`, `in_progress`, `complete`, `skipped`, or
  `text_graphic`.
- **Notes**: human direction for licensing, framing, mood, or edit intent.
- **Layer effects / transition**: voicecut-style effect stack and transition
  metadata.
- **Background color**: hex plate / letterbox fill (default `#000000`); saved to
  `acquisition.json` and `asset_manifest.json`.

`text_graphic` and `effect_only` cues do not require downloaded media, but they
can still carry notes, effects, and transition metadata.

**Text graphic layer** — on historical / stock / artifact cues, enable the
checkbox to composite typography over an acquired photo or video (`text_graphic_layer`
in `acquisition.json` and `asset_manifest.json`, target slot `text_overlay`).

## Environment

| Variable | Purpose |
|----------|---------|
| `MEDIA_REPO_ROOT` | Parent repo path (default: `..`) |
| `DEFAULT_MANIFEST_PATH` | Server default manifest |
| `NEXT_PUBLIC_DEFAULT_MANIFEST_PATH` | Client default manifest |
| `YOUTUBE_API_KEY` | Optional in-app YouTube search |
| `GOOGLE_API_KEY` + `GOOGLE_CSE_ID` | Optional Google Images gallery |
| `WIKIMEDIA_CONTACT` | Commons API User-Agent |
| `OPENAI_API_KEY` | Sticker / title PNG generation (`gpt-image-1` by default) |
| `OPENAI_IMAGE_MODEL` | Override image model (e.g. `gpt-image-1.5`) |
| `GIPHY_API_KEY` | GIPHY sticker search + import (`giphy-*.gif` → Remotion sticker layer) |
