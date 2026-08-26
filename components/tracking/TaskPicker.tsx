"use client";

import { useCallback, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { usePickerMenu } from "@/lib/usePickerMenu";
import { toISODate } from "@/lib/parse";
import { projectColorVar, type Project, type Task } from "@/lib/types";

const MIN_WIDTH = 288;

/**
 * A searchable picker over open tasks — scheduled today first, then most
 * recently scheduled. Used anywhere a segment can be pointed at a task: the
 * dashboard's "start a task" lane, retro-linking a segment, and gap fill.
 */
export default function TaskPicker({
  tasks,
  projects,
  value,
  onChange,
  label = "Task",
  placeholder = "Pick a task",
  /** Adds a "No task" entry that calls onChange("") — for retro-linking, where unlinking is a real choice. */
  clearable = false,
  /** "lg" is the emphasized trigger NOW uses for its input-surface prominence. */
  size = "md",
}: {
  tasks: Task[];
  projects: Project[];
  value: string | undefined;
  onChange: (taskId: string) => void;
  label?: string;
  placeholder?: string;
  clearable?: boolean;
  size?: "md" | "lg";
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const selected = tasks.find((t) => t.id === value);

  const today = toISODate(new Date());
  const open_ = useMemo(
    () =>
      tasks
        .filter((t) => t.status === "open")
        .sort((a, b) => {
          const aToday = a.scheduled === today;
          const bToday = b.scheduled === today;
          if (aToday !== bToday) return aToday ? -1 : 1;
          return b.scheduled.localeCompare(a.scheduled);
        }),
    [tasks, today],
  );

  const filtered = query.trim()
    ? open_.filter((t) => t.title.toLowerCase().includes(query.trim().toLowerCase()))
    : open_;

  const showClear = clearable && !!value;
  // Flat option list for arrow-key nav: the optional "No task" clear entry
  // first, then the filtered tasks.
  const optionCount = filtered.length + (showClear ? 1 : 0);

  const close = useCallback(() => setOpen(false), []);
  const select = useCallback(
    (index: number) => {
      if (showClear && index === 0) {
        onChange("");
        setOpen(false);
        setQuery("");
        return;
      }
      const task = filtered[showClear ? index - 1 : index];
      // Keyboard Enter must agree with the pointer path: the current task's
      // option is `disabled` and doesn't respond to a click.
      if (!task || task.id === value) return;
      onChange(task.id);
      setOpen(false);
      setQuery("");
    },
    [showClear, filtered, onChange, value],
  );

  const { triggerRef, menuRef, position, activeIndex, setActiveIndex, menuId } = usePickerMenu({
    open,
    onClose: close,
    optionCount,
    onSelect: select,
    minWidth: MIN_WIDTH,
  });

  const activeOptionId = activeIndex >= 0 ? `${menuId}-option-${activeIndex}` : undefined;

  return (
    <div className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="listbox"
        // No aria-controls/aria-activedescendant here: while open, the search
        // input below is the live combobox (it owns the text cursor and is
        // what aria-activedescendant should be read relative to) — wiring
        // both it and this button would announce two "Task" comboboxes
        // controlling the same listbox at once.
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 truncate rounded-lg border border-border bg-card transition-colors hover:border-accent/30 ${
          size === "lg"
            ? "min-h-12 w-full max-w-none px-4 py-3 text-[15px]"
            : "min-h-11 max-w-64 px-3 py-2 text-sm sm:min-h-9"
        }`}
      >
        {selected ? (
          <span className="flex min-w-0 items-center gap-1.5 truncate">
            {selected.projectId && projectById.get(selected.projectId) && (
              <span
                aria-hidden
                className="size-1.5 shrink-0 rounded-full"
                style={{ background: projectColorVar(projectById.get(selected.projectId)!.color) }}
              />
            )}
            <span className="truncate">{selected.title}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            data-picker-menu
            className="no-drag fixed z-50 rounded-lg border border-border bg-card py-1 shadow-lg"
            style={{
              left: position?.left ?? -9999,
              width: position?.width ?? MIN_WIDTH,
              visibility: position ? "visible" : "hidden",
              ...(position?.placement === "above" ? { bottom: position.bottom } : { top: position?.top ?? 0 }),
            }}
          >
            <input
              autoFocus
              role="combobox"
              aria-label={label}
              aria-expanded={open}
              aria-controls={menuId}
              aria-activedescendant={activeOptionId}
              aria-autocomplete="list"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tasks…"
              className="w-full border-b border-border bg-transparent px-3 py-2 text-sm outline-none"
            />
            <div id={menuId} role="listbox" aria-label={label} className="max-h-64 overflow-y-auto">
              {showClear && (
                <button
                  type="button"
                  id={`${menuId}-option-0`}
                  role="option"
                  tabIndex={-1}
                  aria-selected={false}
                  onMouseEnter={() => setActiveIndex(0)}
                  onClick={() => select(0)}
                  className={`flex w-full items-center px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground ${
                    activeIndex === 0 ? "bg-muted text-foreground" : ""
                  }`}
                >
                  No task
                </button>
              )}
              {filtered.length === 0 && (
                <p className="px-3 py-2 text-sm text-muted-foreground">No open tasks match.</p>
              )}
              {filtered.map((task, i) => {
                const index = showClear ? i + 1 : i;
                const project = task.projectId ? projectById.get(task.projectId) : undefined;
                const isCurrent = task.id === value;
                return (
                  <button
                    key={task.id}
                    id={`${menuId}-option-${index}`}
                    type="button"
                    role="option"
                    tabIndex={-1}
                    aria-selected={isCurrent}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => select(index)}
                    disabled={isCurrent}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-40 ${
                      index === activeIndex ? "bg-muted" : ""
                    }`}
                  >
                    {project && (
                      <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ background: projectColorVar(project.color) }} />
                    )}
                    <span className="min-w-0 flex-1 truncate">{task.title}</span>
                    {task.scheduled === today && (
                      <span className="shrink-0 text-xs text-muted-foreground">Today</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
