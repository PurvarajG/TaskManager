"use client";

import { useTasks } from "@/lib/store-context";

/** Shows the server's own wording, so "That didn't save" is the last resort. */
export default function ErrorToast() {
  const { error, dismissError } = useTasks();
  if (!error) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-1/2 z-[70] flex -translate-x-1/2 items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-lg"
    >
      <span className="text-sm">{error}</span>
      <button
        onClick={dismissError}
        className="rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        Dismiss
      </button>
    </div>
  );
}
