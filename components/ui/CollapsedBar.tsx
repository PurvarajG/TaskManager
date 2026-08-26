/**
 * The single-line "Backlog · 12 · Expand" disclosure bar from the
 * tempo-focus prototype's collapsed board column. Introduced in Phase 0 as a
 * shared primitive; no call site wires it in yet — Phase 3 replaces the
 * kanban backlog column with it.
 */
export default function CollapsedBar({
  label,
  count,
  onExpand,
  expandLabel = "Expand",
  dropProps,
}: {
  label: string;
  count: number;
  onExpand: () => void;
  expandLabel?: string;
  /** Drag/drop handlers from useBoardDrag's `columnProps`, so a collapsed
   *  backlog column stays a valid drop target — see components/kanban/Board.tsx. */
  dropProps?: React.HTMLAttributes<HTMLElement>;
}) {
  return (
    <button
      type="button"
      onClick={onExpand}
      {...dropProps}
      className="no-drag flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3.5 py-2.5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
    >
      <span className="flex items-center gap-2 text-sm font-medium text-foreground">
        {label}
        <span className="font-mono text-xs text-muted-foreground">· {count}</span>
      </span>
      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-accent">
        {expandLabel}
      </span>
    </button>
  );
}
