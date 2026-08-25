"use client";

import { useState } from "react";
import { useTasks } from "@/lib/store-context";
import SectionLabel from "../SectionLabel";

/**
 * A scratch checklist, deliberately lighter than a task: no date, estimate, or
 * project. Anything that turns out to be real work can graduate into a proper
 * task, which opens in the shared panel ready to edit.
 */
export default function QuickTodos({ hideLabel = false }: { hideLabel?: boolean }) {
  const { quickTodos, addQuickTodo, patchQuickTodo, deleteQuickTodo, convertQuickTodo } =
    useTasks();
  const [draft, setDraft] = useState("");
  const [converting, setConverting] = useState<string | null>(null);

  const ordered = [...quickTodos].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <section>
      {!hideLabel && <SectionLabel>Quick list</SectionLabel>}

      <ul className="mt-3 space-y-1">
        {ordered.map((todo) => (
          <li key={todo.id} className="group flex items-center gap-2.5">
            <button
              onClick={() => patchQuickTodo(todo.id, { done: !todo.done })}
              aria-label={todo.done ? `Reopen ${todo.title}` : `Complete ${todo.title}`}
              className={`size-4 shrink-0 rounded-full border-2 transition-colors ${
                todo.done ? "border-accent bg-accent" : "border-border hover:border-accent"
              }`}
            />

            <input
              value={todo.title}
              aria-label={`Rename ${todo.title}`}
              onChange={(e) => patchQuickTodo(todo.id, { title: e.target.value })}
              className={`min-w-0 flex-1 rounded-md bg-transparent px-1 py-1 text-sm outline-none focus:bg-card ${
                todo.done ? "text-muted-foreground line-through" : ""
              }`}
            />

            <button
              disabled={converting === todo.id}
              onClick={async () => {
                setConverting(todo.id);
                await convertQuickTodo(todo.id);
                setConverting(null);
              }}
              className="shrink-0 rounded-md px-1.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus:opacity-100 disabled:opacity-40 group-hover:opacity-100"
            >
              {converting === todo.id ? "…" : "→ Task"}
            </button>

            <button
              onClick={() => deleteQuickTodo(todo.id)}
              aria-label={`Delete ${todo.title}`}
              className="shrink-0 px-1 text-muted-foreground opacity-0 hover:text-foreground focus:opacity-100 group-hover:opacity-100"
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      <input
        value={draft}
        aria-label="Add to quick list"
        placeholder="Add something small"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter" || !draft.trim()) return;
          addQuickTodo(draft.trim());
          setDraft("");
        }}
        className="mt-2 h-9 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-accent/40"
      />
    </section>
  );
}
