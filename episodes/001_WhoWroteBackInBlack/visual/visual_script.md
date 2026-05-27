# Visual beat sheet (fast) — aligned to master transcript (~5m 53s; preview clip ~54.8s in `transcript/preview/`)

**Faceless:** no host on camera; everything is B-roll, textures, environments, hands-only, silhouettes, typography, and stock motion.

**Naming real people, dates, and events (in this doc):** Yes. The visual script is **your editorial plan**—you can write **literal** names (Bon Scott, Brian Johnson), **dates** (1980, Feb 1980), **places**, and **events** so the edit stays specific. That text is not the same as **publishing someone else’s photo or artwork**; each **image or clip** you ship still needs a **license that matches your use** (and normal rules around defamation / false claims still apply to what you *say*, not to merely naming public figures in commentary).

**Finding those visuals:** Yes, often. **Wikimedia Commons** has many **historical and press** photos of real people and concerts; our fetcher stores **license + credit** in `media/credits.json` so you can comply. Results are **search-noisy**—tune `visual_manifest.json` queries (add years, “live”, “tour”, band member names) and **re-run or swap** a slot if the first hit is wrong. **Album cover art**, **logos**, and some **promo stills** can be **extra restricted** even when a *live crowd shot* is fine, so prefer **live / press / news context** imagery when you want literal band history without leaning on packaged artwork.

**Do not bulk-scrape Google Images:** it breaks Google’s terms, almost never gives you a usable license, and “fair use” is not a substitute for knowing the rights on each file. For **clean modern B-roll** (neon, UI, stock reactions), the manifest uses **`unsplash`** on selected rows only.

Pace target: **hard cuts every ~0.8–2.5s** on stressed words; **video beats** for motion (still via Pexels in `fetch_visuals.py`). Times: use `transcript/who_wrote_back_in_black.json` or **timeline/** voicecut cues.

| TC in | TC out | Line / beat | Visual (flash) | Media |
|------:|-------:|---------------|----------------|-------|
| 0.00 | 1.58 | “Ladies… jury,” | Court / jury box, low angle, high contrast | photo |
| 1.98 | 3.88 | “I'm gonna… case here” | **Faceless:** hands + mic + papers on desk; energy without a face | video |
| 3.88 | 7.20 | “about… history.” | Vinyl / album stack → **AC/DC energy** (crowd or stage light, not literal IP) | photo |
| 7.52 | 9.00 | “Some… crazy,” | Split-face / “hot take” reaction B-roll | photo |
| 9.30 | 10.36 | “or… facts.” | Documents, highlighter, “evidence” vibe | photo |
| 10.92 | 13.68 | “Fine… out.” | Rapid: shrug → sit → lean in (3 micro-cuts if you have plates) | video |
| 13.92 | 17.38 | “Because… about.” | Conspiracy board / strings / news clippings (tasteful, not cheesy) | photo |
| 18.02 | 18.70 | “Here goes.” | Hard flash + title card sting (optional) | photo |
| 19.16 | 21.14 | “Bon Scott… Black.” | **70s rock silhouette / mic / tour bus** (generic, no trademark art) | video |
| 21.58 | 23.46 | “Yeah… much.” | Bold type on black: “THE CLAIM” | photo |
| 24.16 | 26.12 | “I said… obvious.” | Lightbulb / neon “obvious” | photo |
| 26.62 | 28.56 | “Let's… 1980.” | Calendar page / “1980” typographic smash | photo |
| 28.56 | 31.32 | “The man… five.” | Cemetery rain OR clock montage (respectful tone) | photo |
| 31.94 | 34.22 | “And his… band.” | Band walking into studio hallway (generic studio B-roll) | video |
| 34.94 | 39.62 | “Goes… music.” | Recording console meters peaking → **stadium crowd** wave | video |
| 40.52 | 44.32 | “50 million… that.” | Numbers counting fast overlay / “sales ticker” | photo |
| 45.32 | 49.18 | “Wait… convenient?” | Side-eye macro, **security cam** aesthetic (fiction) | photo |
| 50.08 | 54.83 | “Personally… buy it.” | Wallet closing / “declined” / hard cut to black | photo |

**`visual/visual_manifest.json`:** Read **`manifest_note`** at the top. Each slot has **`label`**, **`query`**, and **`recommended_source`** (`llm` \| `wikimedia_commons` \| `pexels` \| `unsplash` \| `local`). **Recommended source is advisory** — it tells you (and `credits.json`) where you *intend* to source the shot; **`provider`** is what the fetch script actually runs (`commons`, `unsplash`, `pexels`, `local`, or **`placeholder`**). **`placeholders`** points at shared **`media/manual/PLACEHOLDER.jpg`** and **`.mp4`** (gray stubs). Slots with **`provider": "placeholder"`** copy those into **`media/{id}.jpg`** / **`.mp4`** so the timeline has stand-ins until you swap in a real file or change the slot to another provider.

**Local images you found yourself:** put them under **`media/manual/`**. Set **`"provider": "local"`** and **`"local_path": "media/manual/yourfile.jpg"`**. Re-run `tools/fetch_visuals.py` — it **copies** into **`media/{slot id}.ext`**. Optional **`"credit_note"`** lands in **`media/credits.json`**.

Set `PEXELS_API_KEY`, `UNSPLASH_ACCESS_KEY` (if used), and ideally `WIKIMEDIA_CONTACT`, then run `tools/fetch_visuals.py`.
