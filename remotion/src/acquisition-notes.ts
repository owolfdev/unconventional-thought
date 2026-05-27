/**
 * Heuristic interpretation of media_tool acquisition "Notes"
 * (editorial intent — not sent to generative APIs by default).
 */

export type AcquisitionNoteHints = {
  /** Hide / fade media until this frame (0 = immediate). */
  mediaDelayFrames: number;
  blackAndWhite: boolean;
  highContrast: boolean;
  /** Show full asset (contain), not a center crop (cover). */
  showFullImage: boolean;
  /** Full 360° rotation on the media layer over the cue. */
  fullFrameSpin: boolean;
  /** When rotating, scale up so frame stays filled (no corner black). */
  spinCoverScale: number;
  extrudedRockTitle: boolean;
  multiColorBold: boolean;
  goldShine: boolean;
  textExtraBig: boolean;
  /** Large type (notes: XL, font size xl). */
  textXL: boolean;
  /** Extra-large type (notes: XXL, font size xxl). */
  textXXL: boolean;
  /** Title visible from frame 0 (notes: start early). */
  textStartEarly: boolean;
  /** Taller line height / leading for typography overlays. */
  textLooseLeading: boolean;
  /** Slightly taller leading (between default and loose). */
  textRelaxedLeading: boolean;
  /** Narrower max-width so lines wrap into a vertical stack. */
  textNarrowColumn: boolean;
  /** Reveal comma-separated phrases one at a time across the cue. */
  commaSeparatedBlocks: boolean;
  /** Fast character-at-a-time typewriter (short lines). */
  textPunchyTypewriter: boolean;
  /** Plate stays static — no push/zoom/scroll camera motion. */
  stillPlate: boolean;
};

const EMPTY: AcquisitionNoteHints = {
  mediaDelayFrames: 0,
  blackAndWhite: false,
  highContrast: false,
  showFullImage: false,
  fullFrameSpin: false,
  spinCoverScale: 1,
  extrudedRockTitle: false,
  multiColorBold: false,
  goldShine: false,
  textExtraBig: false,
  textXL: false,
  textXXL: false,
  textStartEarly: false,
  textLooseLeading: false,
  textRelaxedLeading: false,
  textNarrowColumn: false,
  commaSeparatedBlocks: false,
  textPunchyTypewriter: false,
  stillPlate: false,
};

export function interpretAcquisitionNotes(
  notes: string | null | undefined,
  fps: number,
): AcquisitionNoteHints {
  if (!notes?.trim()) {
    return { ...EMPTY };
  }
  const n = notes.toLowerCase();
  const h = { ...EMPTY };

  const bringLater =
    /bring\s+(the\s+)?(image|picture|photo|video|clip|media)/i.test(notes) &&
    /(later|delay|after|seconds?\s+late|second\s+late)/i.test(notes);
  const lateArrival = /come\s+in\s+(after|late)/i.test(notes);
  if (bringLater || lateArrival) {
    if (/\b2\s*sec/i.test(notes)) {
      h.mediaDelayFrames = Math.round(2 * fps);
    } else if (/\b3\s*sec|\ba\s+few|few\s+of\s+sec|few\s+sec|couple/i.test(notes)) {
      h.mediaDelayFrames = Math.round(3 * fps);
    } else {
      h.mediaDelayFrames = Math.round(2.5 * fps);
    }
  }

  if (/black\s+and\s+white|b\s*&\s*w|grayscale|greyscale|monochrome/i.test(n)) {
    h.blackAndWhite = true;
  }
  if (/high\s+contrast|crushed|crush\s+black/i.test(n)) {
    h.highContrast = true;
  }

  if (
    /square\s+image|whole\s+(square\s+)?image|entire\s+image|full\s+image/i.test(
      n,
    ) ||
    /show\s+(the\s+)?entire|do\s+not\s+crop|don'?t\s+crop|no\s+crop|not\s+the\s+parent/i.test(
      n,
    )
  ) {
    h.showFullImage = true;
  }

  if (
    (/whole|entire|full\s+square|square\s+image/i.test(n) && /spin/i.test(n)) ||
    /whole\s+image.*spin|entire\s+image.*spin/i.test(n)
  ) {
    h.fullFrameSpin = true;
    h.showFullImage = true;
    if (/no\s+black|within\s+the\s+parent|no\s+black\s+parts/i.test(n)) {
      h.spinCoverScale = 1.48;
    }
  }

  if (/extruded|rock\s+video\s+title|rock\s+poster|heavy\s+metal/i.test(n)) {
    h.extrudedRockTitle = true;
  }
  if (/multi[-\s]?colou?r|colourful|colorful|rainbow/i.test(n)) {
    h.multiColorBold = true;
  }
  if (/colorful.*bold|bold.*big/i.test(n)) {
    h.multiColorBold = true;
    h.textExtraBig = true;
  }
  if (
    /super\s+bold|really\s+big|make\s+.*\s+big|50\s*million|gold.*shine|gradient\s+shine|animated\s+gold/i.test(
      n,
    )
  ) {
    if (/50\s*million|gold|shine|gradient/i.test(n)) {
      h.goldShine = true;
    }
    if (/super\s+bold|multi[-\s]?color|colourful|colorful|rainbow/i.test(n)) {
      h.multiColorBold = true;
    }
    h.textExtraBig = true;
  }
  if (
    /make\s+the\s+text\s+big|big\s+and\s+bold|big\s+bold|\bbig\s+text\b/i.test(
      n,
    )
  ) {
    h.textExtraBig = true;
  }
  if (/\bxxl\b|font\s+size\s+xxl|extra\s+large\s+text/i.test(n)) {
    h.textXXL = true;
    h.textExtraBig = true;
  } else if (/\bxl\b|font\s+size\s+xl\b/i.test(n)) {
    h.textXL = true;
  }
  if (/start\s+early|from\s+the\s+start|immediate(ly)?\s+on/i.test(n)) {
    h.textStartEarly = true;
  }
  if (/relaxed\s+lead|bit\s+more\s+line|slightly\s+taller\s+line/i.test(n)) {
    h.textRelaxedLeading = true;
  } else if (
    /line\s*height|line\s*spacing|loose\s+lead|leading|tall\s+lines/i.test(n)
  ) {
    h.textLooseLeading = true;
  }
  if (
    /narrow\s+column|narrow\s+text|vertical\s+stack|squeeze\s+horizontal|tighter\s+column|narrow\s+width/i.test(
      n,
    )
  ) {
    h.textNarrowColumn = true;
  }
  if (
    /comma[\s-]*separat|separated\s+block|each\s+comma|comma\s+block/i.test(n)
  ) {
    h.commaSeparatedBlocks = true;
  }
  if (/punchy|fast\s+typewriter|quick\s+typewriter|snappy\s+text/i.test(n)) {
    h.textPunchyTypewriter = true;
  }
  if (
    /still\s+(image|photo|frame|shot)|no\s+(camera|push|zoom)|no\s+push|without\s+(camera|motion|movement)|frozen\s+frame/i.test(
      n,
    )
  ) {
    h.stillPlate = true;
  }

  return h;
}

export function noteMediaFilter(hints: AcquisitionNoteHints): string | undefined {
  const parts: string[] = [];
  if (hints.blackAndWhite) {
    parts.push("grayscale(1)");
  }
  if (hints.highContrast) {
    parts.push("contrast(1.35)");
    parts.push("brightness(0.95)");
  }
  return parts.length ? parts.join(" ") : undefined;
}
