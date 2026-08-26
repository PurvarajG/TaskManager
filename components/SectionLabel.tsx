/**
 * The recurring orientation badge: accent dot + mono uppercase label.
 * Used at the head of every section so the page has a consistent rhythm.
 *
 * `variant="eyebrow"` adds the tempo-focus prototype's bordered pill used
 * ahead of a page's serif h1 (design-prototypes/tempo-focus/index.html's
 * `.eyebrow`) — a slightly larger, more open version of the same
 * dot-plus-mono-label shape. The default "plain" variant is unchanged:
 * PageShell and every existing call site depend on its exact markup and the
 * `.no-drag` opt-out, so it keeps its own render path rather than being
 * reimplemented in terms of the new one.
 */
export default function SectionLabel({
  children,
  pulse = false,
  variant = "plain",
}: {
  children: React.ReactNode;
  pulse?: boolean;
  variant?: "plain" | "eyebrow";
}) {
  if (variant === "eyebrow") {
    return (
      <span className="no-drag inline-flex items-center gap-2.5 rounded-full border border-accent/40 px-3.5 py-2">
        <span
          className={`size-1.5 rounded-full bg-accent ${pulse ? "animate-pulse-dot" : ""}`}
        />
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
          {children}
        </span>
      </span>
    );
  }

  return (
    <span className="no-drag inline-flex items-center gap-2.5 rounded-full border border-accent/30 bg-accent/5 px-3.5 py-1.5">
      <span
        className={`size-1.5 rounded-full bg-accent ${pulse ? "animate-pulse-dot" : ""}`}
      />
      <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-accent">
        {children}
      </span>
    </span>
  );
}
