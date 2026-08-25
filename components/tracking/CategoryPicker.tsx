"use client";

import { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { usePickerMenu } from "@/lib/usePickerMenu";
import type { Category } from "@/lib/types";
import CategoryDot from "./CategoryDot";

const MIN_WIDTH = 192;

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

  const close = useCallback(() => setOpen(false), []);
  const select = useCallback(
    (index: number) => {
      const category = options[index];
      // Keyboard Enter must agree with the pointer path: the current
      // category's option is `disabled` and doesn't respond to a click, so
      // Enter on it is a no-op too rather than silently re-firing onChange.
      if (!category || category.id === value) return;
      onChange(category.id);
      setOpen(false);
    },
    [options, onChange, value],
  );

  const { triggerRef, menuRef, position, activeIndex, setActiveIndex, menuId } = usePickerMenu({
    open,
    onClose: close,
    optionCount: options.length,
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
        aria-controls={open ? menuId : undefined}
        aria-activedescendant={open ? activeOptionId : undefined}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm transition-colors hover:border-accent/30 sm:min-h-9"
      >
        {selected ? <CategoryDot color={selected.color} /> : <span className="size-2 shrink-0 rounded-full bg-muted" />}
        <span className={selected ? "" : "text-muted-foreground"}>{selected?.name ?? "Pick a category"}</span>
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            data-picker-menu
            id={menuId}
            role="listbox"
            aria-label={label}
            className="no-drag fixed z-50 max-h-64 overflow-y-auto rounded-lg border border-border bg-card py-1 shadow-lg"
            style={{
              left: position?.left ?? -9999,
              width: position?.width ?? MIN_WIDTH,
              visibility: position ? "visible" : "hidden",
              ...(position?.placement === "above" ? { bottom: position.bottom } : { top: position?.top ?? 0 }),
            }}
          >
            {options.map((category, index) => {
              const isCurrent = category.id === value;
              return (
                <button
                  key={category.id}
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
                  <CategoryDot color={category.color} />
                  <span className="truncate">{category.name}</span>
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
}
