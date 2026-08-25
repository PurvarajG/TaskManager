"use client";

import ModuleCard from "@/components/tracking/ModuleCard";

/**
 * A disclosure panel for a page's side rail — reuses Tracking's ModuleCard
 * shell rather than inventing a second card language. The one thing
 * ModuleCard doesn't do on its own: when a panel has nothing in it, it
 * collapses to a single quiet line instead of a full bordered card holding
 * a sentence of grey text.
 */
export default function RailPanel({
  title,
  collapsed,
  onToggleCollapse,
  empty = false,
  emptyText,
  children,
}: {
  title: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
  /** When true, renders the quiet empty-state line instead of the card. */
  empty?: boolean;
  emptyText?: string;
  children: React.ReactNode;
}) {
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
    <ModuleCard title={title} collapsed={collapsed} onToggleCollapse={onToggleCollapse}>
      {children}
    </ModuleCard>
  );
}
