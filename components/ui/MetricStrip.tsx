/**
 * Inline mono uppercase stat row — "68% complete · 2 need attention".
 * Introduced as the shared primitive for the stat rows currently hand-rolled
 * per-page (Today, the project workspace, Tracking, Next 7 Days). Phase 0
 * only introduces the primitive; wiring those pages onto it is a later
 * phase's job, so this component has no existing call sites yet.
 */
export interface MetricStripItem {
  /** The emphasised lead value, e.g. "68%" or "1h 35m". */
  value: React.ReactNode;
  /** The quiet trailing label, e.g. "complete" or "need attention". */
  label: React.ReactNode;
  key?: string;
}

export default function MetricStrip({
  items,
  className = "",
}: {
  items: MetricStripItem[];
  className?: string;
}) {
  if (items.length === 0) return null;

  return (
    <div
      className={`flex flex-wrap items-center gap-x-6 gap-y-1.5 font-mono text-[10px] uppercase tracking-[0.13em] text-muted-foreground ${className}`}
    >
      {items.map((item, i) => (
        <span key={item.key ?? i} className="whitespace-nowrap">
          <strong className="font-semibold text-foreground">{item.value}</strong> {item.label}
        </span>
      ))}
    </div>
  );
}
