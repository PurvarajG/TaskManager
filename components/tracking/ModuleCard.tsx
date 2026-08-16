"use client";

import { useState } from "react";
import SectionLabel from "../SectionLabel";

/**
 * The shell every tracking module uses — none hand-roll it. Outer frame at
 * border-border/70, bg-muted/30 header row (the same language as
 * DashboardTimeline's hour header), an optional right-side action slot, and
 * a collapse toggle so a stacked dashboard of six modules can be tamed.
 */
export default function ModuleCard({
  title,
  action,
  collapsible = true,
  defaultCollapsed = false,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <section className="overflow-hidden rounded-xl border border-border/70 bg-card">
      <div className="flex items-center justify-between gap-3 bg-muted/30 px-4 py-2.5">
        <SectionLabel>{title}</SectionLabel>
        <div className="flex shrink-0 items-center gap-2">
          {action}
          {collapsible && (
            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
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

      {!collapsed && <div className="p-4">{children}</div>}
    </section>
  );
}
