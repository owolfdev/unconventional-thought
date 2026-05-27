"use client";

interface Props {
  itemId: string;
  saving: boolean;
  onSaveAndContinue: () => void;
  onDiscardAndContinue: () => void;
  onCancel: () => void;
}

export function UnsavedChangesDialog({
  itemId,
  saving,
  onSaveAndContinue,
  onDiscardAndContinue,
  onCancel,
}: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="unsaved-title"
    >
      <div className="w-full max-w-md rounded-xl border border-amber-900/50 bg-zinc-950 p-6 shadow-2xl">
        <h2
          id="unsaved-title"
          className="text-lg font-semibold text-amber-300"
        >
          Unsaved settings
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-300">
          <span className="font-mono text-amber-400">{itemId}</span> has changes
          that are not saved to disk yet. Save before leaving so visual mode,
          effects, selections, and text layers are not lost.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-lg border border-zinc-600 px-4 py-2 text-sm hover:bg-zinc-900 disabled:opacity-50"
          >
            Stay on this cue
          </button>
          <button
            type="button"
            onClick={onDiscardAndContinue}
            disabled={saving}
            className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-900 disabled:opacity-50"
          >
            Leave without saving
          </button>
          <button
            type="button"
            onClick={onSaveAndContinue}
            disabled={saving}
            className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium hover:bg-amber-600 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save settings & continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
