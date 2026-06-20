export const GALLERY_SIZES = ["tiny", "small", "medium", "large"] as const;

export type GallerySize = (typeof GALLERY_SIZES)[number];

const STORAGE_KEY = "media_tool.gallerySize";

const ALIASES: Record<string, GallerySize> = {
  tiny: "tiny",
  xs: "tiny",
  mini: "tiny",
  small: "small",
  sm: "small",
  s: "small",
  medium: "medium",
  md: "medium",
  m: "medium",
  med: "medium",
  large: "large",
  lg: "large",
  l: "large",
  xl: "large",
  big: "large",
};

export interface GallerySizeConfig {
  label: GallerySize;
  /** Tailwind width class for each thumb (strip) or cell */
  thumbWidth: string;
  thumbHeight: string;
  showTitle: boolean;
  layout: "strip" | "grid";
  gridClass: string;
  sectionMaxHeight: string;
}

export const GALLERY_SIZE_CONFIG: Record<GallerySize, GallerySizeConfig> = {
  tiny: {
    label: "tiny",
    thumbWidth: "w-[4.5rem]",
    thumbHeight: "h-12",
    showTitle: false,
    layout: "strip",
    gridClass: "",
    sectionMaxHeight: "",
  },
  small: {
    label: "small",
    thumbWidth: "w-20",
    thumbHeight: "h-16",
    showTitle: false,
    layout: "strip",
    gridClass: "",
    sectionMaxHeight: "",
  },
  medium: {
    label: "medium",
    thumbWidth: "w-28",
    thumbHeight: "h-20",
    showTitle: true,
    layout: "strip",
    gridClass: "",
    sectionMaxHeight: "",
  },
  large: {
    label: "large",
    thumbWidth: "w-full",
    thumbHeight: "h-24",
    showTitle: true,
    layout: "grid",
    gridClass: "grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4",
    sectionMaxHeight: "max-h-56 overflow-y-auto",
  },
};

export function parseGallerySize(raw: string): GallerySize | null {
  const key = raw.trim().toLowerCase();
  return ALIASES[key] ?? null;
}

export function isGallerySize(raw: string): raw is GallerySize {
  return (GALLERY_SIZES as readonly string[]).includes(raw);
}

export function loadGallerySize(): GallerySize {
  if (typeof window === "undefined") return "tiny";
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && isGallerySize(saved)) return saved;
  return "tiny";
}

export function saveGallerySize(size: GallerySize): void {
  localStorage.setItem(STORAGE_KEY, size);
}

export function gallerySizeHelp(current: GallerySize): string {
  return [
    `Gallery size: ${current}`,
    "Set with @gallery <size> or @gallery size <size>",
    `Sizes: ${GALLERY_SIZES.join(" · ")}`,
    "Aliases: xs/sm/md/lg · s/m/l · mini · big",
  ].join("\n");
}
