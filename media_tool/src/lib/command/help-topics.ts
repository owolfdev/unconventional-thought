import type { GallerySize } from "./gallery-size";
import { formatEffectsHelp } from "./effect-commands";
import { formatModesHelp } from "./mode-commands";

export const HELP_TOPIC_IDS = [
  "render",
  "generate",
  "sticker",
  "text",
  "effects",
  "mode",
  "search",
  "cue",
  "gallery",
  "inpoint",
  "episode",
  "play",
  "save",
] as const;

export type HelpTopic = (typeof HELP_TOPIC_IDS)[number];

const TOPIC_ALIASES: Record<string, HelpTopic> = {
  render: "render",
  renders: "render",
  generate: "generate",
  gen: "generate",
  sticker: "sticker",
  stickers: "sticker",
  overlay: "sticker",
  overlays: "sticker",
  text: "text",
  title: "text",
  titles: "text",
  effect: "effects",
  effects: "effects",
  mode: "mode",
  modes: "mode",
  search: "search",
  cue: "cue",
  cues: "cue",
  nav: "cue",
  navigate: "cue",
  gallery: "gallery",
  inpoint: "inpoint",
  in: "inpoint",
  episode: "episode",
  episodes: "episode",
  play: "play",
  save: "save",
  persist: "save",
  acquisition: "save",
};

export function resolveHelpTopic(raw: string): HelpTopic | null {
  const key = raw.trim().toLowerCase();
  return TOPIC_ALIASES[key] ?? null;
}

export function formatHelpTopicList(): string {
  return HELP_TOPIC_IDS.map((id) => `  @help ${id}`).join("\n");
}

export function formatUnknownHelpTopic(raw: string): string {
  return [`Unknown help topic: ${raw}`, "", "Topics:", formatHelpTopicList()].join(
    "\n",
  );
}

export function formatHelpIndex(): string {
  return [
    "Command help — use @help <topic> for detail:",
    formatHelpTopicList(),
    "",
    "Quick reference:",
    "  @info @layers @effects @status   read current cue",
    "  @cue 22  @next  @prev            navigate",
    "  @search library <query>         gallery search",
    "  @generate image <prompt>        OpenAI plate image",
    "  @overlay place top_right        overlay placement",
    "  @text add Rock N Roll           dynamic text graphic",
    "  @render 0 2                     start quarter-res preview render",
    "  @render all                     render full sequence preview",
    "  @render list preview            list saved mp4s",
    "  @render load 1                  load into preview panel",
    "",
    "Cue refs: 22 · 022 · m22 · m022 (same cue)",
    "⌃/⌘ ] next cue · ⌃/⌘ [ prev cue",
    "Enter submit · Shift+Enter newline · Legacy UI: ?legacy=1",
  ].join("\n");
}

function formatRenderHelp(): string {
  return [
    "Render — preview/full mp4s in remotion/out/render_<NNN>/",
    "",
    "Start a new preview render (quarter res, saves to disk):",
    "  @render <cue>              single cue",
    "  @render <from> <to>        inclusive cue range",
    "  @render all                full manifest range",
    "  @render final <cue>        single cue, full res",
    "  @render final <from> <to>  cue range, full res",
    "  @render 0 3                cues 0–3",
    "  @render final all          full manifest range, full res",
    "",
    "Browse saved renders:",
    "  @render list               all (preview + full)",
    "  @render list preview       quarter-res only",
    "  @render list final         full-res only",
    "",
    "Load into preview panel (below prompt):",
    "  @render load <#>           list number from last @render list",
    "  @render load preview-m000  match by filename/title",
    "",
    "Delete files on disk:",
    "  @render delete <#|title>",
    "  @render delete all",
    "  @render delete preview all",
    "  @render delete final all",
    "",
    "Playback (after render completes or load):",
    "  @play                      once",
    "  @play loop                  infinite",
    "  @play loop 5                N times",
  ].join("\n");
}

function formatGenerateHelp(): string {
  return [
    "Generate — OpenAI raster assets saved to the cue/library:",
    "  @generate sticker <prompt>  transparent PNG overlay",
    "  @generate image <prompt>    photoreal plate image",
    "",
    "Examples:",
    "  @generate sticker cracked vinyl skull emblem",
    "  @generate image smoky 1979 arena crowd, cinematic documentary frame",
    "",
    "Notes:",
    "  Sticker = pixel-rendered overlay, auto-selected on the cue.",
    "  Image = pixel-rendered plate, auto-selected on the cue.",
    "  Dynamic titles/text are under @help text, not @generate.",
  ].join("\n");
}

function formatStickerHelp(): string {
  return [
    "Overlay — add/control the cue's sticker-style overlay layer:",
    "  @overlay add <n>            use gallery result n as overlay",
    "  @overlay clear              remove sticker/GIF selection",
    "  @overlay place center       centered overlay",
    "  @overlay place right",
    "  @overlay place top_left",
    "  @overlay place bottom_right",
    "",
    "Aliases: @sticker add|clear|place …",
    "",
    "Positions:",
    "  center · left · right · top · bottom",
    "  top_left · top_right · bottom_left · bottom_right",
    "",
    "Generate/select first, then place:",
    "  @generate sticker cracked vinyl skull",
    "  @overlay place top_right",
    "",
    "Notes:",
    "  @overlay add works for image/GIF gallery results and library assets.",
    "  Video results are not supported on this overlay layer.",
  ].join("\n");
}

function formatTextHelp(): string {
  return [
    "Text — procedural/dynamic typography for the current cue:",
    "  @text add Rock N Roll       set text content",
    "  @text animate typewriter    set animation/style",
    "  @text animate word_reveal",
    "  @text size xl              size token: sm|md|lg|xl|xxl",
    "  @text clear                remove current text graphic",
    "",
    "How targeting works:",
    "  In @mode text, commands edit the full-cue text graphic.",
    "  In other modes, commands edit the text overlay layer.",
    "",
    "Useful pairings:",
    "  @mode text                 full-screen typography cue",
    "  @mode historical           return to plate-based cue",
    "",
    "Starter animations:",
    "  typewriter · word_reveal · minimal · stamp · neon",
  ].join("\n");
}

function formatSearchHelp(): string {
  return [
    "Search — fills the gallery strip (then @add / @preview):",
    "  @search library <query>    local _library assets",
    "  @search google <query>     Puppeteer scrape (may CAPTCHA)",
    "  @search bing <query>       Puppeteer scrape",
    "  @search gif <query>        GIPHY stickers",
    "  @search video <query>      YouTube scrape",
    "",
    "After search:",
    "  @add <n>                   stage result n on current cue",
    "  @preview <n>               open gallery lightbox for result n",
    "  @gallery [tiny|small|medium|large]   thumb size",
  ].join("\n");
}

function formatCueHelp(): string {
  return [
    "Cue navigation:",
    "  @cue 22  @22  @m022         jump to cue (22 = m022)",
    "  @next                       next cue",
    "  @prev                       previous cue",
    "  @next incomplete            next cue not complete",
    "  ⌃/⌘ ]  next · ⌃/⌘ [  prev",
    "",
    "Read current cue:",
    "  @info                       timing, spoken, editorial",
    "  @layers                     selected plates + overlays",
    "  @effects                    effect stack on this cue",
    "  @status                     acquisition status + dirty flag",
    "",
    "Phase 5 (stubs — not fully wired):",
    "  @cue split: … @end",
    "  @cue merge 8 9",
    "  @use 8  @confirm  @cancel",
  ].join("\n");
}

function formatGalleryHelp(current: GallerySize): string {
  return [
    "Gallery — thumb size for search results:",
    "  @gallery                    show current size",
    "  @gallery tiny|small|medium|large",
    "  @gallery size medium         alias",
    "",
    `Current: ${current}`,
    "Sizes: tiny · small · medium · large",
    "Aliases: xs/sm/md/lg · s/m/l · mini · big",
    "",
    "See also: @help search",
  ].join("\n");
}

function formatInpointHelp(): string {
  return [
    "Video in-point — trim start of active video plate:",
    "  @inpoint                    show current in-point",
    "  @inpoint 45                 seconds",
    "  @inpoint 1:23.4             m:ss or m:ss.d",
    "  @inpoint playhead           use current preview playhead",
    "  @inpoint clear              reset to 0",
    "",
    "Updates in memory — @save to persist to acquisition.json.",
    "Remotion uses start_from_sec on the selected video plate.",
  ].join("\n");
}

function formatEpisodeHelp(): string {
  return [
    "Episode switching:",
    "  @episodes                   list episodes + manifest paths",
    "  @episode 002                load by number or id prefix",
    "  @episode 000_Sandbox        load by folder id",
    "",
    "Unsaved cue changes block @episode — @save first.",
  ].join("\n");
}

function formatPlayHelp(): string {
  return [
    "Play loaded render preview:",
    "  @play                       play once",
    "  @play loop                  loop forever",
    "  @play loop 5                 play 5 times",
    "",
    "Requires a completed @render or @render load in the preview panel.",
    "See also: @help render",
  ].join("\n");
}

function formatSaveHelp(): string {
  return [
    "Persist acquisition + workspace:",
    "  @save                       write acquisition.json for all cues",
    "  @complete                   mark current cue complete + save",
    "  @clear                      clear response log",
    "",
    "@effect and @mode save immediately (per cue).",
    "@inpoint and plate edits need @save unless auto-saved elsewhere.",
    "",
    "Dirty flag shown in @status — save before @episode or navigation warns.",
  ].join("\n");
}

export function formatHelpTopic(
  topic: HelpTopic,
  opts?: { gallerySize?: GallerySize },
): string {
  switch (topic) {
    case "render":
      return formatRenderHelp();
    case "generate":
      return formatGenerateHelp();
    case "sticker":
      return formatStickerHelp();
    case "text":
      return formatTextHelp();
    case "effects":
      return formatEffectsHelp();
    case "mode":
      return formatModesHelp();
    case "search":
      return formatSearchHelp();
    case "cue":
      return formatCueHelp();
    case "gallery":
      return formatGalleryHelp(opts?.gallerySize ?? "tiny");
    case "inpoint":
      return formatInpointHelp();
    case "episode":
      return formatEpisodeHelp();
    case "play":
      return formatPlayHelp();
    case "save":
      return formatSaveHelp();
  }
}
