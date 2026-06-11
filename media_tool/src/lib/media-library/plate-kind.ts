import type { LibraryKind } from "./types";

/** Library kinds that can be staged as a cue background (plate). */
export const PLATE_LIBRARY_KINDS: LibraryKind[] = ["archive", "generated"];

export function isLibraryPlateKind(kind: LibraryKind | string): boolean {
  return PLATE_LIBRARY_KINDS.includes(kind as LibraryKind);
}

export const PLATE_LIBRARY_KINDS_PARAM = PLATE_LIBRARY_KINDS.join(",");
