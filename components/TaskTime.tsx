"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { useTasks } from "@/lib/store-context";
import { fmt, fmtDate } from "@/lib/format";
import { toISODate } from "@/lib/parse";
import type { Task } from "@/lib/types";
import CategoryDot from "./tracking/CategoryDot";
import { inputClass, labelClass } from "./ui/Field";

function clockLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function clock(startedAt: string, now: number): string {
  const seconds = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

/**
 * The wall clock is an external store, so that's how it's read: subscribing
 * only while a timer runs, and re-rendering exactly once per second rather
 * than calling Date.now() during render.
 */
export function useElapsed(startedAt: string | undefined): string {
  const subscribe = useCallback(
    (notify: () => void) => {
      if (!startedAt) return () => {};
      const id = setInterval(notify, 1000);
      return () => clearInterval(id);
    },
    [startedAt],
  );

  const now = useSyncExternalStore(
    subscribe,
    () => Math.floor(Date.now() / 1000) * 1000,
    () => 0,
  );

  return startedAt ? clock(startedAt, now) : "";
}

export default function TaskTime({ task }: { task: Task }) {
  const {
    running,
    startTimer,
    stopTimer,
    entriesFor,
    recordedMinutes,
    addManualEntry,
    patchTimeEntry,
    deleteTimeEntry,
    categories,
  } = useTasks();

  const isRunning = running?.taskId === task.id;
  const elapsed = useElapsed(isRunning ? running?.startedAt : undefined);
  const entries = entriesFor(task.id).filter((e) => e.endedAt);
  const recorded = recordedMinutes(task.id);

  const [adding, setAdding] = useState(false);
  const [minutes, setMinutes] = useState("30");
  const [date, setDate] = useState(toISODate(new Date()));

  return (
    <section className="space-y-3">
      <h3 className={labelClass}>Time</h3>

      <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
        <button
          onClick={() => (isRunning ? stopTimer() : startTimer(task.id))}
          className={`min-h-11 rounded-lg px-3 py-2 text-sm font-medium transition-all sm:min-h-9 ${
            isRunning
              ? "bg-muted text-foreground hover:bg-border"
              : "bg-gradient-to-r from-accent to-accent-secondary text-accent-foreground hover:brightness-110"
          }`}
        >
          {isRunning ? "Stop timer" : "Start timer"}
        </button>

        {isRunning && (
          <span className="font-mono text-sm tabular-nums" aria-live="polite">
            {elapsed}
          </span>
        )}

        <span className="ml-auto text-right font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
          {fmt(recorded)} of {fmt(task.minutes)}
          <span className="sr-only"> recorded against the estimate</span>
        </span>
      </div>

      {entries.length > 0 && (
        <ul className="space-y-1.5">
          {entries.map((entry) => {
            const category = categories.find((c) => c.id === entry.categoryId);
            return (
              <li key={entry.id} className="flex items-center gap-2 text-sm">
                {category && (
                  <span
                    className="flex shrink-0 items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground"
                    title={category.name}
                  >
                    <CategoryDot color={category.color} />
                    {category.name}
                  </span>
                )}
                <span className="w-40 shrink-0 truncate font-mono text-[11px] text-muted-foreground">
                  {fmtDate(entry.startedAt.slice(0, 10))} {clockLabel(entry.startedAt)}
                  {entry.endedAt ? ` – ${clockLabel(entry.endedAt)}` : ""}
                </span>
                <input
                  type="number"
                  min={1}
                  aria-label={`Minutes recorded on ${fmtDate(entry.startedAt.slice(0, 10))}`}
                  defaultValue={entry.minutes}
                  onBlur={(e) => {
                    const next = Number(e.target.value);
                    if (next > 0 && next !== entry.minutes) patchTimeEntry(entry.id, { minutes: next });
                  }}
                  className="h-8 w-16 shrink-0 rounded-lg border border-border bg-card px-2 text-sm outline-none focus:border-accent/40"
                />
                <input
                  defaultValue={entry.note ?? ""}
                  placeholder="Note"
                  aria-label={`Note for the session on ${fmtDate(entry.startedAt.slice(0, 10))}`}
                  onBlur={(e) => {
                    if (e.target.value !== (entry.note ?? "")) patchTimeEntry(entry.id, { note: e.target.value });
                  }}
                  className="min-w-0 flex-1 truncate rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm text-muted-foreground outline-none transition-colors hover:border-border focus:border-accent/40 focus:bg-card focus:text-foreground"
                />
                <button
                  onClick={() => deleteTimeEntry(entry.id)}
                  aria-label="Delete time entry"
                  className="shrink-0 px-1 text-muted-foreground hover:text-foreground"
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {adding ? (
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <label htmlFor="manual-date" className={labelClass}>
              Date
            </label>
            <input
              id="manual-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="manual-minutes" className={labelClass}>
              Minutes
            </label>
            <input
              id="manual-minutes"
              type="number"
              min={1}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              className={`${inputClass} w-24`}
            />
          </div>
          <button
            onClick={async () => {
              const value = Number(minutes);
              if (!(value > 0)) return;
              await addManualEntry({
                taskId: task.id,
                startedAt: new Date(`${date}T09:00`).toISOString(),
                minutes: value,
              });
              setAdding(false);
            }}
            className="min-h-11 rounded-lg bg-muted px-3 py-2 text-sm font-medium hover:bg-border sm:min-h-9"
          >
            Record
          </button>
          <button
            onClick={() => setAdding(false)}
            className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="min-h-11 rounded-lg px-1 text-left font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground sm:min-h-0"
        >
          + Record time manually
        </button>
      )}
    </section>
  );
}
