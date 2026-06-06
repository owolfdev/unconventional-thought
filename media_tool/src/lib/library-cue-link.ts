/** Link to /library with cue context so assets can be selected for a cue. */
export function libraryHrefForCue(
  manifestPath: string,
  itemId: string,
): string {
  const returnTo = `/?path=${encodeURIComponent(manifestPath)}&itemId=${encodeURIComponent(itemId)}`;
  const params = new URLSearchParams({
    path: manifestPath,
    itemId,
    returnTo,
  });
  return `/library?${params.toString()}`;
}
