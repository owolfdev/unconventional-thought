"use client";

import { useCallback, useEffect, useRef } from "react";

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  busy?: boolean;
  placeholder?: string;
  className?: string;
}

export function PromptInput({
  value,
  onChange,
  onSubmit,
  disabled = false,
  busy = false,
  placeholder = "Search, @help, or natural language…",
  className = "",
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const focus = useCallback(() => {
    ref.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || e.shiftKey) return;
      const active = document.activeElement;
      if (active === ref.current) return;
      if (active?.closest("[data-testid='command-gallery']")) return;
      e.preventDefault();
      focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focus]);

  useEffect(() => {
    focus();
  }, [focus]);

  return (
    <div
      className={`shrink-0 border-t border-zinc-800 bg-zinc-950 px-4 py-3 ${className}`}
    >
      <label className="mb-1 block font-mono text-xs text-zinc-500">
        prompt · Enter submit · Shift+Enter newline · Tab → gallery
      </label>
      <textarea
        ref={ref}
        rows={2}
        className="max-h-32 w-full resize-none rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-sm text-zinc-100 outline-none focus:border-amber-600/80"
        value={value}
        disabled={disabled || busy}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSubmit();
          }
        }}
      />
    </div>
  );
}
