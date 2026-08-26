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
}: {
  /** The row's headline content. */
  children: React.ReactNode;
  /** The quiet line beneath the headline, e.g. "24 minutes · choose what you were doing". */
  detail?: React.ReactNode;
  /** Optional trailing content on the headline row (actions, a value). */
  trailing?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`border-t border-border/70 py-2.5 text-sm first:border-t-0 first:pt-0 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">{children}</div>
        {trailing && <div className="flex shrink-0 items-center gap-1.5">{trailing}</div>}
      </div>
      {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
    </div>
  );
}
