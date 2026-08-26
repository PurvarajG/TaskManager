/**
 * The prototype's `.panel-row` treatment: a headline line with an optional
 * quiet detail line beneath it, separated from its siblings by a top border
 * (no border on the first row). Shared by the tracking dashboard's
 * "Unaccounted time" and "Signals" modules so both restyle from the same
 * primitive instead of two hand-rolled list treatments.
 */
export default function PanelRow({
  children,
  detail,
  trailing,
  className = "",
  as: Tag = "div",
}: {
  /** The row's headline content. */
  children: React.ReactNode;
  /** The quiet line beneath the headline, e.g. "24 minutes · choose what you were doing". */
  detail?: React.ReactNode;
  /** Optional trailing content on the headline row (actions, a value). */
  trailing?: React.ReactNode;
  className?: string;
  /** Render as a different element, e.g. "li" when the caller wraps rows in a <ul>. */
  as?: "div" | "li";
}) {
  return (
    <Tag className={`border-t border-border/70 py-2.5 text-sm first:border-t-0 first:pt-0 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">{children}</div>
        {trailing && <div className="flex shrink-0 items-center gap-1.5">{trailing}</div>}
      </div>
      {/* A div, not a p: callers pass structured detail (Signals' per-kind
          <ul>), and a list inside a <p> is closed by the HTML parser, which
          both drops these styles and mismatches hydration. */}
      {detail && <div className="mt-1 text-xs text-muted-foreground">{detail}</div>}
    </Tag>
  );
}
