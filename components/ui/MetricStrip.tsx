/**
 * Inline mono uppercase stat row — "68% complete · 2 need attention".
 * Introduced as the shared primitive for the stat rows currently hand-rolled
 * per-page (Today, the project workspace, Tracking, Next 7 Days).
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
    <dl
      className={`flex flex-wrap items-center gap-x-6 gap-y-1.5 font-mono text-[10px] uppercase tracking-[0.13em] text-muted-foreground ${className}`}
    >
      {items.map((item, i) => (
        <div key={item.key ?? i} className="flex gap-1 whitespace-nowrap">
          {/*
            A dl pairs each dt with the dd that FOLLOWS it in DOM order, so the
            term must come first in the markup. The prototype shows the value
            first visually; that flip is done with CSS `order`, never by
            emitting the dd ahead of its dt.
          */}
          <dt className="order-2">{item.label}</dt>
          <dd className="order-1 font-semibold text-foreground">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
