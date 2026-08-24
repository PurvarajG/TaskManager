"use client";

import { useState } from "react";
import { useTasks } from "@/lib/store-context";
import type { Task } from "@/lib/types";
import { labelClass } from "./ui/Field";

export default function SubtaskList({ task }: { task: Task }) {
  const { addSubtask, toggleSubtask, deleteSubtask } = useTasks();
  const [text, setText] = useState("");
  const done = task.subtasks.filter((s) => s.done).length;

  return (
    <section className="space-y-2">
      <h3 className={labelClass}>
        Subtasks{task.subtasks.length > 0 && ` · ${done}/${task.subtasks.length}`}
      </h3>

      <ul className="space-y-1.5">
        {task.subtasks.map((s) => (
          <li key={s.id} className="group flex items-center gap-2.5">
            <button
              onClick={() => toggleSubtask(task.id, s.id, !s.done)}
              aria-label={s.done ? `Reopen ${s.title}` : `Complete ${s.title}`}
              className={`size-4 shrink-0 rounded-full border-2 transition-colors ${
                s.done ? "border-accent bg-accent" : "border-border hover:border-accent"
              }`}
            />
            <span
              className={`select-text flex-1 text-sm ${s.done ? "text-muted-foreground line-through" : ""}`}
            >
              {s.title}
            </span>
            <button
              onClick={() => deleteSubtask(task.id, s.id)}
              aria-label={`Delete ${s.title}`}
              className="shrink-0 px-1 text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus:opacity-100 group-hover:opacity-100"
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      <input
        value={text}
        aria-label="Add subtask"
        placeholder="Add subtask"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && text.trim()) {
            addSubtask(task.id, text.trim());
            setText("");
          }
        }}
        className="h-9 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-accent/40"
      />
    </section>
  );
}
