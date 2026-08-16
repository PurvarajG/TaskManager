"use client";

import { useState } from "react";
import type { Category } from "@/lib/types";
import CategoryDot from "./CategoryDot";

/** A dot + name button that opens a list of every non-archived category. */
export default function CategoryPicker({
  categories,
  value,
  onChange,
  label = "Category",
}: {
  categories: Category[];
  value: string | undefined;
  onChange: (categoryId: string) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = categories.find((c) => c.id === value);
  const options = categories.filter((c) => !c.archived || c.id === value);

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm transition-colors hover:border-accent/30 sm:min-h-9"
      >
        {selected ? <CategoryDot color={selected.color} /> : <span className="size-2 shrink-0 rounded-full bg-muted" />}
        <span className={selected ? "" : "text-muted-foreground"}>{selected?.name ?? "Pick a category"}</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 max-h-64 w-48 overflow-y-auto rounded-lg border border-border bg-card py-1 shadow-lg">
          {options.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => {
                onChange(category.id);
                setOpen(false);
              }}
              disabled={category.id === value}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-40"
            >
              <CategoryDot color={category.color} />
              <span className="truncate">{category.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
