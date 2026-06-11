/** Link to /library with cue context so assets can be selected for a cue. */
export function libraryHrefForCue(
  manifestPath: string,
  itemId: string,
  opts?: { libraryId?: string | null; crop?: boolean },
): string {
  const returnTo = `/?path=${encodeURIComponent(manifestPath)}&itemId=${encodeURIComponent(itemId)}`;
  const params = new URLSearchParams({
    path: manifestPath,
    itemId,
    returnTo,
  });
  const libraryId = opts?.libraryId?.trim();
  if (libraryId) params.set("assetId", libraryId);
  if (opts?.crop) params.set("crop", "1");
  return `/library?${params.toString()}`;
}
