"use client";

import { useTasks } from "@/lib/store-context";
import type { AttentionItem } from "@/lib/focus";

/**
 * The prototype's warm `.attention` card — overdue tasks and stalled-waiting
 * tasks that need a human decision, not just a glance. Sits beside
 * `FocusCard` in the project workspace's focus band. Each row opens the same
 * shared task panel every other list in the app uses.
 */
export default function AttentionPanel({
  title = "Needs attention",
  items,
  emptyText = "Nothing needs a decision right now.",
}: {
  title?: string;
  items: AttentionItem[];
  emptyText?: string;
}) {
  const { openTask } = useTasks();

  return (
    <aside className="rounded-2xl border-l-[3px] border-attention bg-attention-surface p-5 shell:p-4">
      <h3 className="font-display text-lg font-bold shell:text-base">{title}</h3>

      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="mt-1">
          {items.map(({ task, detail }, i) => (
            <li
              key={task.id}
              className={`grid grid-cols-[8px_1fr] gap-2.5 py-2.5 shell:py-1.5 ${
                i > 0 ? "border-t border-attention-border" : ""
              }`}
            >
              <span aria-hidden className="mt-1 size-2 shrink-0 rounded-full bg-attention" />
              <button
                onClick={() => openTask(task.id)}
                className="select-text min-w-0 text-left"
              >
                <b className="block truncate text-[13px] font-semibold">{task.title}</b>
                <small className="mt-1 block text-muted-foreground">{detail}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
