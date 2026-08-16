"use client";

import { useState } from "react";
import { useTasks } from "@/lib/store-context";
import type { Gap } from "@/lib/types";
import CategoryPicker from "./CategoryPicker";
import TaskPicker from "./TaskPicker";

/**
 * A backfill is either a category (its own category picker) or a task (its
 * category comes from the task's project, server-side) — never both, same
 * one-subject rule a live segment follows. Shared by Unaccounted and the ribbon.
 */
export default function GapFillForm({ gap, onFilled }: { gap: Gap; onFilled: () => void }) {
  const { categories, tasks, projects, fillGap } = useTasks();
  const [categoryId, setCategoryId] = useState<string | undefined>(categories[0]?.id);
  const [taskId, setTaskId] = useState<string | undefined>(undefined);
  const [note, setNote] = useState("");

  const canFill = !!taskId || !!categoryId;

  return (
    <>
      {taskId ? (
        <TaskPicker tasks={tasks} projects={projects} value={taskId} onChange={setTaskId} clearable />
      ) : (
        <>
          <CategoryPicker categories={categories} value={categoryId} onChange={setCategoryId} />
          <span className="text-xs text-muted-foreground">or</span>
          <TaskPicker
            tasks={tasks}
            projects={projects}
            value={taskId}
            onChange={setTaskId}
            placeholder="Link a task"
          />
        </>
      )}
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note (optional)"
        className="min-w-0 flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-accent/40"
      />
      <button
        onClick={() => {
          if (!canFill) return;
          fillGap({
            startedAt: gap.startedAt,
            endedAt: gap.endedAt,
            ...(taskId ? { taskId } : { categoryId }),
            note: note || undefined,
          });
          onFilled();
        }}
        disabled={!canFill}
        className="min-h-11 shrink-0 rounded-lg bg-gradient-to-r from-accent to-accent-secondary px-3 py-2 text-sm font-medium text-accent-foreground hover:brightness-110 disabled:opacity-50 sm:min-h-9"
      >
        Fill
      </button>
    </>
  );
}
