"use client";

import { useState } from "react";
import SectionLabel from "../SectionLabel";

/**
 * The card chrome shared by every disclosure panel in the app — previously
 * duplicated between `tracking/ModuleCard` (the collapsible card frame) and
 * `ui/RailPanel` (the same frame, plus a quiet dashed-line empty state).
 * Both of those are now thin wrappers over this component so existing call
 * sites keep their exact prop shapes and behaviour.
 */
export default function Panel({
  title,
  action,
  collapsible = true,
  defaultCollapsed = false,
  collapsed: collapsedProp,
  onToggleCollapse,
  empty = false,
  emptyText,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  /** Controlled collapse state — when paired with `onToggleCollapse`, the caller
   *  owns persistence. Omit both to fall back to local state. */
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  /** When true, renders the quiet empty-state line instead of the full card. */
  empty?: boolean;
  emptyText?: string;
  children: React.ReactNode;
}) {
  const [localCollapsed, setLocalCollapsed] = useState(defaultCollapsed);
  const collapsed = onToggleCollapse ? (collapsedProp ?? false) : localCollapsed;
  const toggle = onToggleCollapse ?? (() => setLocalCollapsed((v) => !v));

  if (empty) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border/60 px-3.5 py-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
          {title}
        </span>
        <span className="truncate text-xs text-muted-foreground/60">{emptyText}</span>
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-border/70 bg-card">
      <div
        className={`flex items-center justify-between gap-3 rounded-t-xl bg-muted/30 px-3.5 py-2 ${collapsed ? "rounded-b-xl" : ""}`}
      >
        <SectionLabel>{title}</SectionLabel>
        <div className="flex shrink-0 items-center gap-2">
          {action}
          {collapsible && (
            <button
              type="button"
              onClick={toggle}
              aria-expanded={!collapsed}
              aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <span
                aria-hidden
                className={`inline-block font-mono text-xs transition-transform motion-safe:duration-200 ${collapsed ? "-rotate-90" : ""}`}
              >
                ▾
              </span>
            </button>
          )}
        </div>
      </div>

      {!collapsed && <div className="p-3.5">{children}</div>}
    </section>
  );
}
