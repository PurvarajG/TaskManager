"use client";

import { useEffect, useRef, useState } from "react";
import { inputClass, selectClass } from "@/components/ui/Field";
import { useTasks } from "@/lib/store-context";

/**
 * The "+ New" chip on the NOW card: a small popover that creates a preset,
 * pinned activity in one step so it appears as a chip immediately.
 */
export default function QuickAddActivity() {
  const { categories, addActivity } = useTasks();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [lastCategoryId, setLastCategoryId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeCategories = [...categories].filter((c) => !c.archived).sort((a, b) => a.sortOrder - b.sortOrder);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    function onPointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  function openPopover() {
    const fallback = activeCategories.find((c) => c.kind !== "unclassified") ?? activeCategories[0];
    setCategoryId(lastCategoryId ?? fallback?.id ?? "");
    setName("");
    setOpen(true);
  }

  function submit() {
    const trimmed = name.trim();
    if (!trimmed || !categoryId) return;
    addActivity({ categoryId, name: trimmed, isPreset: true, pinned: true });
    setLastCategoryId(categoryId);
    setOpen(false);
    setName("");
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => (open ? setOpen(false) : openPopover())}
        className="flex min-h-11 items-center gap-1 rounded-full border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-accent/30 hover:text-foreground sm:min-h-9"
      >
        + New
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-2 w-64 space-y-2 rounded-lg border border-border bg-card p-3 shadow-lg">
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
              if (e.key === "Escape") setOpen(false);
            }}
            placeholder="Activity name"
            aria-label="New activity name"
            className={inputClass}
          />
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            aria-label="Category"
            className={selectClass}
          >
            {activeCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={!name.trim()}
              className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
