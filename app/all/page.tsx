"use client";

import { useMemo } from "react";
import { useTasks } from "@/lib/store-context";
import { toISODate } from "@/lib/parse";
import { useDragReorder } from "@/lib/useDragReorder";
import TaskRow from "@/components/TaskRow";
import QuickAdd from "@/components/QuickAdd";
import PageShell from "@/components/ui/PageShell";

export default function AllPage() {
  const { tasks, ready, reorderTasks } = useTasks();
  const todayISO = toISODate(new Date());

  const open = useMemo(
    () => tasks.filter((t) => t.status === "open").sort((a, b) => a.sortOrder - b.sortOrder),
    [tasks],
  );

  const { list, dragHandleProps } = useDragReorder(open, reorderTasks);

  return (
    <PageShell
      label="All Tasks"
      title={
        <>
          Everything <span className="gradient-text">open</span>
        </>
      }
      headerExtra={
        <p className="mt-3 text-sm text-muted-foreground">
          Drag to set your own order — this view doesn&apos;t re-sort by priority.
        </p>
      }
    >
      <QuickAdd autoFocus={false} />

      {ready && list.length === 0 && (
        <p className="mt-10 rounded-xl border border-dashed border-border px-6 py-14 text-center text-sm text-muted-foreground">
          Nothing open. Nice.
        </p>
      )}

      <ul className="mt-10 space-y-2.5">
        {list.map((t) => (
          <TaskRow
            key={t.id}
            task={t}
            todayISO={todayISO}
            showDate
            draggable
            dragHandleProps={dragHandleProps(t.id)}
          />
        ))}
      </ul>
    </PageShell>
  );
}
