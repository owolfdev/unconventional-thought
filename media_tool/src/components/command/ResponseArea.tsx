"use client";

import { useEffect, useRef } from "react";
import type { ResponseLine } from "@/lib/command/types";

interface Props {
  lines: ResponseLine[];
  className?: string;
}

const toneClass: Record<NonNullable<ResponseLine["tone"]>, string> = {
  info: "text-zinc-300",
  error: "text-red-400",
  success: "text-emerald-400",
  warn: "text-amber-300",
};

export function ResponseArea({ lines, className = "" }: Props) {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [lines]);

  return (
    <section
      ref={sectionRef}
      className={`min-h-0 overflow-y-auto bg-zinc-900/50 px-4 py-3 ${className}`}
      aria-live="polite"
    >
      <p className="mb-2 font-mono text-xs uppercase tracking-wide text-zinc-500">
        response
      </p>
      {lines.length === 0 ? (
        <p className="font-mono text-sm text-zinc-600">
          @help for directives · @search library|google|gif|video …
        </p>
      ) : (
        <ul className="space-y-2">
          {lines.map((line, i) => (
            <li
              key={`${i}-${line.text.slice(0, 24)}`}
              className={`whitespace-pre-wrap font-mono text-sm ${toneClass[line.tone ?? "info"]}`}
            >
              {line.text}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
