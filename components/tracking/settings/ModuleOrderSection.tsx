"use client";

import { useTasks } from "@/lib/store-context";
import { MODULE_TITLE } from "@/lib/tracking-modules";
import { useDragReorder } from "@/lib/useDragReorder";

/** Drag to reorder, toggle to hide — the dashboard renders modules exactly in this order. */
export default function ModuleOrderSection() {
  const { settings, patchSettings } = useTasks();
  // Hooks can't follow an early return, so the fallback keeps this call
  // unconditional even though the parent page never renders this section
  // before settings has loaded.
  const rows = (settings?.moduleOrder ?? []).map((key) => ({ id: key, key }));
  const { list, dragHandleProps } = useDragReorder(rows, (moduleOrder) => patchSettings({ moduleOrder }));
  if (!settings) return null;

  return (
    <ul className="space-y-1.5">
      {list.map(({ key }) => {
        const hidden = settings.hiddenModules.includes(key);
        return (
          <li
            key={key}
            {...dragHandleProps(key)}
            className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2"
          >
            <span aria-hidden className="cursor-grab text-muted-foreground">
              ⠿
            </span>
            <span className={`flex-1 text-sm ${hidden ? "text-muted-foreground" : ""}`}>
              {MODULE_TITLE[key] ?? key}
            </span>
            <button
              role="switch"
              aria-checked={!hidden}
              aria-label={hidden ? `Show ${MODULE_TITLE[key] ?? key}` : `Hide ${MODULE_TITLE[key] ?? key}`}
              onClick={() =>
                patchSettings({
                  hiddenModules: hidden
                    ? settings.hiddenModules.filter((k) => k !== key)
                    : [...settings.hiddenModules, key],
                })
              }
              className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                hidden ? "bg-border" : "bg-accent"
              }`}
            >
              <span
                className={`absolute top-0.5 size-4 rounded-full bg-card transition-all ${
                  hidden ? "left-0.5" : "left-[18px]"
                }`}
              />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
