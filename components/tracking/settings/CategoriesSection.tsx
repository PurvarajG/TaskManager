"use client";

import { useState } from "react";
import { useTasks } from "@/lib/store-context";
import { CATEGORY_COLOR_TOKENS, CATEGORY_KINDS, type CategoryKind } from "@/lib/types";
import { useDragReorder } from "@/lib/useDragReorder";
import CategoryDot from "../CategoryDot";
import { categoryColorVar } from "../colors";

const KIND_LABEL: Record<CategoryKind, string> = {
  work: "Work",
  rest: "Rest",
  upkeep: "Upkeep",
  unclassified: "Unclassified",
};

/** Add, rename, recolour, reorder, archive — the whole taxonomy lives here, never hardcoded in a module. */
export default function CategoriesSection() {
  const { categories, addCategory, patchCategory, deleteCategory, reorderCategories } = useTasks();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<CategoryKind>("work");
  const [pickingColor, setPickingColor] = useState<string | null>(null);

  const visible = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);
  const { list, dragHandleProps } = useDragReorder(visible, reorderCategories);

  return (
    <div className="space-y-3">
      <ul className="space-y-1.5">
        {list.map((category) => (
          <li
            key={category.id}
            {...dragHandleProps(category.id)}
            className={`relative flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 ${
              category.archived ? "opacity-50" : ""
            }`}
          >
            <span aria-hidden className="cursor-grab text-muted-foreground">
              ⠿
            </span>

            <button
              onClick={() => setPickingColor(pickingColor === category.id ? null : category.id)}
              aria-label={`Change colour for ${category.name}`}
              className="shrink-0"
            >
              <CategoryDot color={category.color} className="size-3" />
            </button>

            <input
              value={category.name}
              aria-label={`Rename ${category.name}`}
              onChange={(e) => patchCategory(category.id, { name: e.target.value })}
              className="min-w-0 flex-1 rounded-md bg-transparent px-1 py-1 text-sm outline-none focus:bg-muted"
            />

            <select
              value={category.kind}
              aria-label={`Kind for ${category.name}`}
              onChange={(e) => patchCategory(category.id, { kind: e.target.value as CategoryKind })}
              className="rounded-md border border-border bg-card px-2 py-1 text-xs outline-none focus:border-accent/40"
            >
              {CATEGORY_KINDS.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </select>

            <button
              role="switch"
              aria-checked={category.archived}
              aria-label={category.archived ? `Unarchive ${category.name}` : `Archive ${category.name}`}
              onClick={() => patchCategory(category.id, { archived: !category.archived })}
              className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                category.archived ? "bg-accent" : "bg-border"
              }`}
            >
              <span
                className={`absolute top-0.5 size-4 rounded-full bg-card transition-all ${
                  category.archived ? "left-[18px]" : "left-0.5"
                }`}
              />
            </button>

            <button
              onClick={() => deleteCategory(category.id)}
              aria-label={`Delete ${category.name}`}
              className="shrink-0 px-1 text-muted-foreground hover:text-foreground"
            >
              ×
            </button>

            {pickingColor === category.id && (
              <div className="absolute left-9 top-full z-20 mt-1 flex flex-wrap gap-1.5 rounded-lg border border-border bg-card p-2 shadow-lg">
                {CATEGORY_COLOR_TOKENS.map((token) => (
                  <button
                    key={token}
                    onClick={() => {
                      patchCategory(category.id, { color: token });
                      setPickingColor(null);
                    }}
                    aria-label={`Use ${token}`}
                    className="flex size-7 items-center justify-center rounded-full"
                  >
                    <span
                      className="size-4 rounded-full"
                      style={{
                        background: categoryColorVar(token),
                        boxShadow:
                          category.color === token
                            ? `0 0 0 2px var(--color-card), 0 0 0 4px ${categoryColorVar(token)}`
                            : undefined,
                      }}
                    />
                  </button>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = name.trim();
          if (!trimmed) return;
          addCategory({ name: trimmed, color: CATEGORY_COLOR_TOKENS[categories.length % CATEGORY_COLOR_TOKENS.length], kind });
          setName("");
        }}
        className="flex flex-wrap items-center gap-2"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New category"
          aria-label="New category name"
          className="min-w-0 flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-accent/40"
        />
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as CategoryKind)}
          aria-label="New category kind"
          className="rounded-lg border border-border bg-card px-2 py-2 text-sm outline-none focus:border-accent/40"
        >
          {CATEGORY_KINDS.map((k) => (
            <option key={k} value={k}>
              {KIND_LABEL[k]}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="min-h-11 rounded-lg bg-gradient-to-r from-accent to-accent-secondary px-3 py-2 text-sm font-medium text-accent-foreground hover:brightness-110 sm:min-h-9"
        >
          Add
        </button>
      </form>
    </div>
  );
}
