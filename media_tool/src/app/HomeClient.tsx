"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CommandWorkspace } from "@/components/CommandWorkspace";
import { ReviewWorkspace } from "@/components/ReviewWorkspace";

function HomeRouter() {
  const params = useSearchParams();
  if (params.get("legacy") === "1") {
    return <ReviewWorkspace />;
  }
  return <CommandWorkspace />;
}

export default function HomeClient() {
  return (
    <Suspense
      fallback={
        <div className="p-8 font-mono text-sm text-zinc-500">Loading…</div>
      }
    >
      <HomeRouter />
    </Suspense>
  );
}
