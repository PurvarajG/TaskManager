"use client";

import { useMemo } from "react";
import { useTasks } from "@/lib/store-context";
import { toISODate } from "@/lib/parse";
import { fmtDate } from "@/lib/format";
import SectionLabel from "@/components/SectionLabel";
import TaskRow from "@/components/TaskRow";
import PageShell from "@/components/ui/PageShell";

export default function CompletedPage() {
  const { tasks, ready } = useTasks();
  const todayISO = toISODate(new Date());

  const groups = useMemo(() => {
    const done = tasks
      .filter((t) => t.status === "done" && t.completedAt)
      .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
    const byDay = new Map<string, typeof done>();
    for (const t of done) {
      const day = t.completedAt!.slice(0, 10);
      const list = byDay.get(day) ?? [];
      list.push(t);
      byDay.set(day, list);
    }
    return [...byDay.entries()];
  }, [tasks]);

  return (
    <PageShell
      label="Completed"
      title={
        <>
          What you&apos;ve <span className="gradient-text">shipped</span>
        </>
      }
    >
      {ready && groups.length === 0 && (
        <p className="rounded-xl border border-dashed border-border px-6 py-14 text-center text-sm text-muted-foreground">
          Nothing completed yet.
        </p>
      )}

      <div className="space-y-10">
        {groups.map(([day, dayTasks]) => (
          <section key={day}>
            <SectionLabel>{day === todayISO ? "Today" : fmtDate(day)}</SectionLabel>
            <ul className="mt-5 space-y-2.5">
              {dayTasks.map((t) => (
                <TaskRow key={t.id} task={t} todayISO={todayISO} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </PageShell>
  );
}
