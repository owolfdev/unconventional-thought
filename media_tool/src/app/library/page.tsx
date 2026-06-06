import { Suspense } from "react";
import { LibraryBrowser } from "@/components/LibraryBrowser";

export const dynamic = "force-dynamic";

export default function LibraryPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-zinc-500">
          Loading library…
        </div>
      }
    >
      <LibraryBrowser />
    </Suspense>
  );
}
