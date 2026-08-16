"use client";

import { useMemo, useState } from "react";
import { fmt } from "@/lib/format";
import { useTasks } from "@/lib/store-context";
import CategoryPicker from "../CategoryPicker";
import MetaLabel from "../MetaLabel";
import { segmentLabel, segmentSubject } from "../segment-label";

function clockLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** A plain editable table of the day's segments — the fallback when a module above doesn't cover it. */
export default function RecordsModule({ now }: { now: Date }) {
  const { segments, categories, activities, tasks, projects, patchSegment, deleteSegment, openTask } = useTasks();
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [ascending, setAscending] = useState(true);

  const rows = useMemo(() => {
    const filtered = filterCategory === "all" ? segments : segments.filter((s) => s.categoryId === filterCategory);
    return [...filtered].sort((a, b) =>
      ascending ? a.startedAt.localeCompare(b.startedAt) : b.startedAt.localeCompare(a.startedAt),
    );
  }, [segments, filterCategory, ascending]);

  if (segments.length === 0) {
    return <p className="text-sm text-muted-foreground">No segments recorded today.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <MetaLabel as="div">Filter</MetaLabel>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          aria-label="Filter by category"
          className="rounded-lg border border-border bg-card px-2 py-1.5 text-sm outline-none focus:border-accent/40"
        >
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          onClick={() => setAscending((v) => !v)}
          className="rounded-lg px-2 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          Sort {ascending ? "↑" : "↓"}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[48rem] text-sm">
          <thead>
            <tr className="border-b border-border/70 text-left">
              <th className="py-2 pr-3 font-mono text-[10px] font-normal uppercase tracking-[0.1em] text-muted-foreground">
                Time
              </th>
              <th className="py-2 pr-3 font-mono text-[10px] font-normal uppercase tracking-[0.1em] text-muted-foreground">
                Category
              </th>
              <th className="py-2 pr-3 font-mono text-[10px] font-normal uppercase tracking-[0.1em] text-muted-foreground">
                What
              </th>
              <th className="py-2 pr-3 font-mono text-[10px] font-normal uppercase tracking-[0.1em] text-muted-foreground">
                Duration
              </th>
              <th className="py-2 pr-3 font-mono text-[10px] font-normal uppercase tracking-[0.1em] text-muted-foreground">
                Note
              </th>
              <th className="py-2 font-mono text-[10px] font-normal uppercase tracking-[0.1em] text-muted-foreground" />
            </tr>
          </thead>
          <tbody>
            {rows.map((segment) => {
              // now is throttled to a 60s tick, so a segment started moments ago can
              // briefly compute negative — clamp rather than show "-1d -1h".
              const minutes = Math.max(
                0,
                Math.round(
                  (new Date(segment.endedAt ?? now.toISOString()).getTime() - new Date(segment.startedAt).getTime()) /
                    60_000,
                ),
              );
              return (
                <tr key={segment.id} className="border-b border-border/50 last:border-b-0">
                  <td className="whitespace-nowrap py-2 pr-3 font-mono text-xs text-muted-foreground">
                    {clockLabel(segment.startedAt)}
                    {segment.endedAt ? ` – ${clockLabel(segment.endedAt)}` : " – now"}
                  </td>
                  <td className="py-2 pr-3">
                    <CategoryPicker
                      categories={categories}
                      value={segment.categoryId}
                      onChange={(categoryId) => patchSegment(segment.id, { categoryId })}
                    />
                  </td>
                  <td className="truncate py-2 pr-3">
                    {(() => {
                      const subject = segmentSubject(segment, categories, activities, tasks, projects);
                      if (!subject.task) return subject.label;
                      return (
                        <button
                          type="button"
                          onClick={() => openTask(subject.task!.id)}
                          className="inline-flex max-w-full items-center gap-1.5 truncate text-left hover:underline"
                        >
                          {subject.project && (
                            <span
                              aria-hidden
                              className="size-1.5 shrink-0 rounded-full"
                              style={{ background: subject.project.color }}
                            />
                          )}
                          <span className="truncate">{subject.label}</span>
                        </button>
                      );
                    })()}
                  </td>
                  <td className="whitespace-nowrap py-2 pr-3 font-mono text-xs tabular-nums text-muted-foreground">
                    {fmt(minutes)}
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      defaultValue={segment.note ?? ""}
                      aria-label={`Note for ${segmentLabel(segment, categories, activities, tasks)}`}
                      onBlur={(e) => {
                        if (e.target.value !== (segment.note ?? "")) patchSegment(segment.id, { note: e.target.value });
                      }}
                      className="w-full min-w-32 rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm outline-none transition-colors hover:border-border focus:border-accent/40 focus:bg-card"
                    />
                  </td>
                  <td className="py-2 text-right">
                    <button
                      onClick={() => deleteSegment(segment.id)}
                      aria-label="Delete segment"
                      className="px-1 text-muted-foreground hover:text-foreground"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
