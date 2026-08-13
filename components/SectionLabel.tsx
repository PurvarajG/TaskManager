/**
 * The recurring orientation badge: accent dot + mono uppercase label.
 * Used at the head of every section so the page has a consistent rhythm.
 */
export default function SectionLabel({
  children,
  pulse = false,
}: {
  children: React.ReactNode;
  pulse?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2.5 rounded-full border border-accent/30 bg-accent/5 px-3.5 py-1.5">
      <span
        className={`size-1.5 rounded-full bg-accent ${pulse ? "animate-pulse-dot" : ""}`}
      />
      <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-accent">
        {children}
      </span>
    </span>
  );
}
