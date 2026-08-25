"use client";

import { useEffect, useState } from "react";
import type { Task } from "@/lib/types";
import { fmt } from "@/lib/format";
import PageShell from "@/components/ui/PageShell";

export default function TrashPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    fetch("/api/tasks/trash")
      .then((r) => r.json())
      .then(setTasks)
      .finally(() => setReady(true));
  }, []);

  async function restore(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    await fetch(`/api/tasks/${id}/restore`, { method: "POST" });
  }

  async function deleteForever(id: string) {
    if (!confirm("Delete this task permanently? This can't be undone.")) return;
    setTasks((prev) => prev.filter((t) => t.id !== id));
    await fetch(`/api/tasks/${id}/forever`, { method: "DELETE" });
  }

  return (
    <PageShell
      label="Trash"
      title={
        <>
          Let <span className="gradient-text">go</span>
        </>
      }
    >
      {ready && tasks.length === 0 && (
        <p className="rounded-xl border border-dashed border-border px-6 py-14 text-center text-sm text-muted-foreground">
          Nothing in the trash.
        </p>
      )}

      <ul className="space-y-2.5">
        {tasks.map((t) => (
          <li
            key={t.id}
            className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-sm"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold tracking-[-0.01em] text-muted-foreground line-through">
                {t.title}
              </p>
              <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                {fmt(t.minutes)}
              </p>
            </div>
            <button
              onClick={() => restore(t.id)}
              className="shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
            >
              Restore
            </button>
            <button
              onClick={() => deleteForever(t.id)}
              className="shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
            >
              Delete forever
            </button>
          </li>
        ))}
      </ul>
    </PageShell>
  );
}
