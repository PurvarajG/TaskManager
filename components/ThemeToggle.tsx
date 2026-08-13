"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

type Theme = "light" | "dark" | "system";

function apply(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") delete root.dataset.theme;
  else root.dataset.theme = theme;
}

/** Notifies this tab when `cycle` writes; `storage` covers the other tabs. */
const CHANGED = "theme-changed";
const listeners = new Set<() => void>();

function subscribe(notify: () => void) {
  listeners.add(notify);
  window.addEventListener("storage", notify);
  return () => {
    listeners.delete(notify);
    window.removeEventListener("storage", notify);
  };
}

/**
 * The saved theme lives in localStorage, so it's read as an external store
 * rather than copied into state by an effect. The server snapshot is `null`,
 * which renders the placeholder and keeps hydration honest.
 */
export default function ThemeToggle() {
  const theme = useSyncExternalStore(
    subscribe,
    () => (localStorage.getItem("theme") as Theme | null) ?? "system",
    () => null,
  );

  // Writing to the DOM is exactly what an effect is for.
  useEffect(() => {
    if (theme) apply(theme);
  }, [theme]);

  const cycle = useCallback(() => {
    const order: Theme[] = ["system", "light", "dark"];
    const next = order[(order.indexOf(theme ?? "system") + 1) % order.length];
    localStorage.setItem("theme", next);
    for (const notify of listeners) notify();
    window.dispatchEvent(new Event(CHANGED));
  }, [theme]);

  if (!theme) return <div className="size-8" />;

  const label = theme === "system" ? "Auto" : theme === "light" ? "Light" : "Dark";

  return (
    <button
      onClick={cycle}
      aria-label={`Theme: ${label}. Click to change.`}
      title={`Theme: ${label}`}
      className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {theme === "dark" ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      ) : theme === "light" ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <path d="M8 21h8M12 17v4" />
        </svg>
      )}
    </button>
  );
}
