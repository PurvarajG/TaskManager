"use client";

import { useTasks } from "@/lib/store-context";
import SectionLabel from "../SectionLabel";

const STATUS: Record<string, string> = {
  saving: "Saving…",
  saved: "Saved",
  error: "Couldn't save",
};

/**
 * One note, autosaved. On failure the text stays exactly where the user left
 * it — nothing typed is discarded — and Retry sends what is currently on
 * screen rather than the attempt that failed.
 */
export default function GeneralNote({
  compact = false,
  hideLabel = false,
}: {
  compact?: boolean;
  /** Omits the internal SectionLabel — for use inside a rail panel whose
   *  disclosure header already shows the title. */
  hideLabel?: boolean;
}) {
  const { note, noteState, setNote, retryNote } = useTasks();

  return (
    <section>
      <div className="flex items-center justify-between">
        {!hideLabel && <SectionLabel>Notepad</SectionLabel>}
        <span
          aria-live="polite"
          className={`font-mono text-[10px] uppercase tracking-[0.12em] ${
            noteState === "error" ? "text-accent" : "text-muted-foreground"
          } ${hideLabel ? "ml-auto" : ""}`}
        >
          {STATUS[noteState] ?? ""}
        </span>
      </div>

      <textarea
        value={note}
        aria-label="General notepad"
        onChange={(e) => setNote(e.target.value)}
        placeholder="Anything you don't want to lose."
        rows={compact ? 4 : 7}
        className={`${compact ? "min-h-24" : ""} mt-3 w-full resize-y rounded-xl border border-border bg-card px-4 py-3 text-sm leading-relaxed outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-accent/40 focus:ring-2 focus:ring-accent/20`}
      />

      {noteState === "error" && (
        <button
          onClick={retryNote}
          className="mt-2 rounded-lg bg-muted px-3 py-1.5 text-xs font-medium hover:bg-border"
        >
          Retry
        </button>
      )}
    </section>
  );
}
