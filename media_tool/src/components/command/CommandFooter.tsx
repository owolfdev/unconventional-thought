"use client";

import type { GallerySize, GalleryState } from "@/lib/command/types";
import { CommandGallery } from "./CommandGallery";
import { PromptInput } from "./PromptInput";

interface Props {
  prompt: string;
  onPromptChange: (value: string) => void;
  onSubmit: () => void;
  busy?: boolean;
  gallery: GalleryState | null;
  gallerySize: GallerySize;
  onGalleryAdd?: (index: number) => void | Promise<void>;
}

/** Prompt + gallery — always pinned to bottom of command column. */
export function CommandFooter({
  prompt,
  onPromptChange,
  onSubmit,
  busy,
  gallery,
  gallerySize,
  onGalleryAdd,
}: Props) {
  return (
    <div className="flex shrink-0 flex-col border-t-2 border-amber-900/40 bg-zinc-900/95">
      <PromptInput
        value={prompt}
        onChange={onPromptChange}
        onSubmit={onSubmit}
        busy={busy}
        className="border-t-0"
      />
      <CommandGallery
        gallery={gallery}
        size={gallerySize}
        busy={busy}
        onAdd={onGalleryAdd}
      />
    </div>
  );
}
