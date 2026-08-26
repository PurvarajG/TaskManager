"use client";

import { useTasks } from "@/lib/store-context";
import { NAV, UNHIDEABLE_NAV_KEY } from "@/components/Sidebar";
import Toggle from "@/components/ui/Toggle";

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
            <Toggle
              on={!hidden}
              label={hidden ? `Show ${item.label}` : `Hide ${item.label}`}
              disabled={locked}
              onChange={() =>
                patchSettings({
                  hiddenNavItems: hidden
                    ? settings.hiddenNavItems.filter((k) => k !== item.key)
                    : [...settings.hiddenNavItems, item.key],
                })
              }
            />
          </li>
        );
      })}
    </ul>
  );
}
