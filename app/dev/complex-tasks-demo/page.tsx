"use client";

import { useRef, useState } from "react";
import { fmtDate } from "@/lib/format";
import SectionLabel from "@/components/SectionLabel";

/**
 * Throwaway preview of the multi-day-deadline design
 * (docs/superpowers/specs/2026-08-15-multi-day-task-deadlines-design.md).
 * Hardcoded dummy tasks, no store/DB wiring — delete once the real feature
 * lands. Not linked from any nav.
 */

const TODAY = "2026-08-15";

function shiftDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function daysBetween(fromISO: string, toISO: string): number {
  const [fy, fm, fd] = fromISO.split("-").map(Number);
  const [ty, tm, td] = toISO.split("-").map(Number);
  const from = Date.UTC(fy, fm - 1, fd);
  const to = Date.UTC(ty, tm - 1, td);
  return Math.round((to - from) / 86_400_000);
}

type DummyTask = {
  id: string;
  title: string;
  color: string;
  scheduled: string;
  finishDate?: string;
  isComplex: boolean;
  dueTime?: string;
};

const INITIAL_TASKS: DummyTask[] = [
  {
    id: "1",
    title: "Ship pricing page redesign",
    color: "#0052ff",
    scheduled: shiftDays(TODAY, 0),
    finishDate: shiftDays(TODAY, 4),
    isComplex: true,
  },
  {
    id: "2",
    title: "Client onboarding audit",
    color: "#7c3aed",
    scheduled: shiftDays(TODAY, -2),
    finishDate: shiftDays(TODAY, 1),
    isComplex: true,
  },
  {
    id: "3",
    title: "Quarterly report draft",
    color: "#dc2626",
    scheduled: shiftDays(TODAY, -6),
    finishDate: shiftDays(TODAY, -1),
    isComplex: true,
  },
  {
    id: "4",
    title: "Send invoice to Acme",
    color: "#16a34a",
    scheduled: TODAY,
    dueTime: "15:00",
    isComplex: false,
  },
];

const WINDOW_DAYS = 7;
const days = Array.from({ length: WINDOW_DAYS }, (_, i) => shiftDays(TODAY, i - 1));

function dateParts(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function isOverdue(task: DummyTask) {
  const deadline = task.isComplex ? task.finishDate! : task.scheduled;
  return deadline < TODAY;
}

/** Position + width, as a fraction of the visible window, clamped at the edges. */
function barExtent(task: DummyTask) {
  const rawStart = daysBetween(days[0], task.scheduled);
  const rawEnd = daysBetween(days[0], task.finishDate!);
  const clampedStart = Math.max(0, Math.min(days.length - 1, rawStart));
  const clampedEnd = Math.max(0, Math.min(days.length - 1, rawEnd));
  return {
    left: (clampedStart / days.length) * 100,
    width: ((clampedEnd - clampedStart + 1) / days.length) * 100,
  };
}

type DragMode = "move" | "resize-start" | "resize-end";

export default function ComplexTasksDemo() {
  const [isComplex, setIsComplex] = useState(true);
  const [scheduled, setScheduled] = useState(TODAY);
  const [finishDate, setFinishDate] = useState(shiftDays(TODAY, 3));

  const [tasks, setTasks] = useState<DummyTask[]>(INITIAL_TASKS);
  const gridRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{
    id: string;
    mode: DragMode;
    startX: number;
    colWidth: number;
    origScheduled: string;
    origFinish: string;
  } | null>(null);

  function beginDrag(e: React.PointerEvent, task: DummyTask, mode: DragMode) {
    if (!gridRef.current) return;
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // Capture is best-effort: harmless if the browser rejects this pointer id.
    }
    dragState.current = {
      id: task.id,
      mode,
      startX: e.clientX,
      colWidth: gridRef.current.getBoundingClientRect().width / days.length,
      origScheduled: task.scheduled,
      origFinish: task.finishDate!,
    };
  }

  function onDragMove(e: React.PointerEvent) {
    const drag = dragState.current;
    if (!drag) return;
    const dayDelta = Math.round((e.clientX - drag.startX) / drag.colWidth);
    if (dayDelta === 0) return;

    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== drag.id) return t;
        if (drag.mode === "move") {
          return {
            ...t,
            scheduled: shiftDays(drag.origScheduled, dayDelta),
            finishDate: shiftDays(drag.origFinish, dayDelta),
          };
        }
        if (drag.mode === "resize-start") {
          const next = shiftDays(drag.origScheduled, dayDelta);
          return { ...t, scheduled: next > drag.origFinish ? drag.origFinish : next };
        }
        const next = shiftDays(drag.origFinish, dayDelta);
        return { ...t, finishDate: next < drag.origScheduled ? drag.origScheduled : next };
      }),
    );
  }

  function endDrag() {
    dragState.current = null;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-12 px-6 py-12">
      <header>
        <SectionLabel pulse>Dummy preview — not real data</SectionLabel>
        <h1 className="mt-4 font-display text-3xl tracking-[-0.02em]">
          Multi-day task deadlines
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Hardcoded tasks illustrating the spec at{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
            docs/superpowers/specs/2026-08-15-multi-day-task-deadlines-design.md
          </code>
          . Nothing here touches the real store. Drag a timeline bar's body to move it, or
          either end to resize it — the task list above updates live.
        </p>
      </header>

      {/* 1. Task editor mockup */}
      <section>
        <SectionLabel>Task editor</SectionLabel>
        <div className="mt-4 max-w-sm rounded-xl border border-border bg-card p-5 shadow-sm">
          <label className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium">Complex task</span>
            <button
              type="button"
              role="switch"
              aria-checked={isComplex}
              onClick={() => setIsComplex((v) => !v)}
              className={`relative h-6 w-11 shrink-0 overflow-hidden rounded-full transition-colors ${isComplex ? "bg-accent" : "bg-muted"}`}
            >
              <span
                className={`absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow-sm transition-transform ${isComplex ? "translate-x-5" : "translate-x-0"}`}
              />
            </button>
          </label>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                Scheduled
              </span>
              <input
                type="date"
                value={scheduled}
                onChange={(e) => setScheduled(e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm outline-none focus:border-accent/40"
              />
            </div>

            {isComplex ? (
              <div>
                <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                  Finish
                </span>
                <input
                  type="date"
                  value={finishDate}
                  onChange={(e) => setFinishDate(e.target.value)}
                  className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm outline-none focus:border-accent/40"
                />
              </div>
            ) : (
              <div>
                <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                  Time
                </span>
                <input
                  type="time"
                  defaultValue="15:00"
                  className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm outline-none focus:border-accent/40"
                />
              </div>
            )}
          </div>
          <p className="mt-3 font-mono text-[10px] text-muted-foreground">
            {isComplex
              ? finishDate < scheduled
                ? "⚠ finish must be on/after scheduled — would 400"
                : `Spans ${fmtDate(scheduled)} → ${fmtDate(finishDate)}`
              : "Single-day task, Time field shown as usual."}
          </p>
        </div>
      </section>

      {/* 2. Task rows with range badges */}
      <section>
        <SectionLabel>Task list — range badge</SectionLabel>
        <ul className="mt-4 space-y-2.5">
          {tasks.map((task) => (
            <li
              key={task.id}
              className={`flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-opacity ${isOverdue(task) ? "opacity-70" : ""}`}
            >
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: task.color }} />
              <span className="flex-1 truncate text-[15px] font-semibold">{task.title}</span>
              <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                {isOverdue(task) && <span className="text-red-500">Overdue ·</span>}
                {task.isComplex ? (
                  <span>
                    {fmtDate(task.scheduled)} → {fmtDate(task.finishDate!)}
                  </span>
                ) : (
                  <span>{fmtDate(task.scheduled)}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* 3. Day-scale timeline with draggable/resizable spanning bars */}
      <section>
        <SectionLabel>Timeline — day scale, spanning bars</SectionLabel>
        <div className="mt-4 overflow-x-auto pb-2">
          <div className="min-w-[48rem] overflow-hidden rounded-xl border border-border/70">
            <div className="grid grid-cols-[10rem_minmax(0,1fr)] border-b border-border/70 bg-muted/30">
              <div className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                Task
              </div>
              <div className="grid" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(5rem, 1fr))` }}>
                {days.map((iso) => {
                  const date = dateParts(iso);
                  const today = iso === TODAY;
                  return (
                    <div
                      key={iso}
                      className={`border-l border-border/60 px-2 py-2 font-mono text-[10px] ${today ? "bg-accent/10 text-accent" : "text-muted-foreground"}`}
                    >
                      {date.toLocaleDateString(undefined, { weekday: "short" })} {date.getDate()}
                    </div>
                  );
                })}
              </div>
            </div>

            {tasks
              .filter((t) => t.isComplex)
              .map((task) => {
                const { left, width } = barExtent(task);
                return (
                  <div key={task.id} className="grid min-h-14 grid-cols-[10rem_minmax(0,1fr)] border-b border-border/70 last:border-b-0">
                    <div className="flex items-center border-r border-border/70 px-3 text-xs text-muted-foreground">
                      {task.title}
                    </div>
                    <div ref={gridRef} className="relative" style={{ height: 56 }}>
                      <div
                        onPointerDown={(e) => beginDrag(e, task, "move")}
                        onPointerMove={onDragMove}
                        onPointerUp={endDrag}
                        onPointerCancel={endDrag}
                        className="group absolute top-1/2 flex h-7 -translate-y-1/2 cursor-grab items-center truncate rounded px-2 text-[11px] font-medium text-white shadow-sm active:cursor-grabbing"
                        style={{ left: `${left}%`, width: `${width}%`, backgroundColor: task.color }}
                        title={`${task.title}: ${fmtDate(task.scheduled)} → ${fmtDate(task.finishDate!)} — drag to move`}
                      >
                        <span
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            beginDrag(e, task, "resize-start");
                          }}
                          onPointerMove={onDragMove}
                          onPointerUp={endDrag}
                          onPointerCancel={endDrag}
                          className="absolute inset-y-0 left-0 w-2 cursor-ew-resize rounded-l bg-black/0 transition-colors group-hover:bg-black/20"
                        />
                        <span className="pointer-events-none truncate">{task.title}</span>
                        <span
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            beginDrag(e, task, "resize-end");
                          }}
                          onPointerMove={onDragMove}
                          onPointerUp={endDrag}
                          onPointerCancel={endDrag}
                          className="absolute inset-y-0 right-0 w-2 cursor-ew-resize rounded-r bg-black/0 transition-colors group-hover:bg-black/20"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
        <p className="mt-2 font-mono text-[10px] text-muted-foreground">
          Drag a bar's middle to move the whole range (span length preserved); drag either
          edge to resize just that side, clamped so finish never precedes start. Bars clamp
          visually at the visible 7-day window's edges — the quarterly-report bar started 6
          days before today, so only its last day (Fri 14) is in view.
        </p>
      </section>
    </div>
  );
}
