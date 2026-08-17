"use client";

import { useTasks } from "@/lib/store-context";
import { NAV, UNHIDEABLE_NAV_KEY } from "@/components/Sidebar";

/** Hides a nav link from the sidebar. The route itself still loads if navigated to directly. */
export default function NavVisibility() {
  const { settings, patchSettings } = useTasks();
  if (!settings) return null;

  return (
    <ul className="space-y-1.5">
      {NAV.map((item) => {
        const locked = item.key === UNHIDEABLE_NAV_KEY;
        const hidden = settings.hiddenNavItems.includes(item.key);
        return (
          <li
            key={item.key}
            className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2"
          >
            <span className={`flex-1 text-sm ${hidden ? "text-muted-foreground" : ""}`}>
              {item.label}
            </span>
            <button
              role="switch"
              aria-checked={!hidden}
              aria-label={hidden ? `Show ${item.label}` : `Hide ${item.label}`}
              disabled={locked}
              onClick={() =>
                patchSettings({
                  hiddenNavItems: hidden
                    ? settings.hiddenNavItems.filter((k) => k !== item.key)
                    : [...settings.hiddenNavItems, item.key],
                })
              }
              className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                hidden ? "bg-border" : "bg-accent"
              } ${locked ? "cursor-not-allowed opacity-50" : ""}`}
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
