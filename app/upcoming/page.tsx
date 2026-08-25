"use client";

import { useMemo } from "react";
import { useTasks } from "@/lib/store-context";
import { addDays, toISODate } from "@/lib/parse";
import { fmtDate } from "@/lib/format";
import SectionLabel from "@/components/SectionLabel";
import TaskRow from "@/components/TaskRow";
import QuickAdd from "@/components/QuickAdd";
import PageShell from "@/components/ui/PageShell";

export default function UpcomingPage() {
  const { tasks, ready } = useTasks();
  const todayISO = toISODate(new Date());
  const horizon = addDays(todayISO, 6);

  const days = useMemo(() => {
    const open = tasks.filter(
      (t) => t.status === "open" && t.scheduled > todayISO && t.scheduled <= horizon,
    );
    const byDay = new Map<string, typeof open>();
    for (const t of open) {
      const list = byDay.get(t.scheduled) ?? [];
      list.push(t);
      byDay.set(t.scheduled, list);
    }
    return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [tasks, todayISO, horizon]);

  return (
    <PageShell
      label="Next 7 Days"
      title={
        <>
          What&apos;s <span className="gradient-text">coming</span>
        </>
      }
    >
      <QuickAdd autoFocus={false} />

      {ready && days.length === 0 && (
        <p className="mt-10 rounded-xl border border-dashed border-border px-6 py-14 text-center text-sm text-muted-foreground">
          Nothing scheduled in the next week.
        </p>
      )}

      <div className="mt-10 space-y-10">
        {days.map(([day, dayTasks]) => (
          <section key={day}>
            <SectionLabel>{fmtDate(day)}</SectionLabel>
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
