/**
 * The single-task hero card — an inverted, dot-textured surface that can't be
 * confused with an ordinary list item. Extracted from `Today.tsx`'s "Up
 * next" block so the project workspace's focus band (tempo-focus prototype's
 * `.focus-card`) reuses the same shape instead of a second implementation.
 * Today keeps its exact prior look via `surface="foreground"` (its existing
 * token) and `density="regular"`; the project page opts into the prototype's
 * `--color-ink` surface and a denser `density="compact"` so the focus band
 * plus board fit one screen at the `shell:` breakpoint.
 */
const META_OPACITY: Record<"foreground" | "ink", string> = {
  foreground: "text-background/60",
  ink: "text-ink-foreground/60",
};

const SECONDARY_OPACITY: Record<"foreground" | "ink", string> = {
  foreground: "text-background/70 hover:bg-background/10 hover:text-background",
  ink: "text-ink-foreground/70 hover:bg-ink-foreground/10 hover:text-ink-foreground",
};

export default function FocusCard({
  tag,
  title,
  meta,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  surface = "foreground",
  density = "regular",
}: {
  tag: React.ReactNode;
  title: React.ReactNode;
  meta: React.ReactNode[];
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel: string;
  onSecondary: () => void;
  surface?: "foreground" | "ink";
  density?: "regular" | "compact";
}) {
  // Each surface pairs with its OWN on-surface foreground token rather than
  // assuming `text-background` works for both: "foreground" is Today's
  // existing dark-on-light-in-light-mode / light-on-dark-in-dark-mode
  // surface, whose text has always been `text-background` (which inverts
  // correctly alongside it). "ink" is deliberately dark in BOTH themes, so
  // it needs its own always-light foreground token — `--color-ink-foreground`
  // — instead of `text-background`, which is near-black in dark mode.
  const surfaceClass = surface === "ink" ? "bg-ink text-ink-foreground" : "bg-foreground text-background";
  const compact = density === "compact";

  return (
    <div
      className={`relative overflow-hidden rounded-2xl ${surfaceClass} p-7 shadow-elevated ${
        compact ? "shell:rounded-xl shell:p-4" : "lg:rounded-xl lg:p-5"
      }`}
    >
      <div className="dot-texture pointer-events-none absolute inset-0" />
      <div className="relative">
        <span className="inline-flex items-center gap-2.5 rounded-full bg-gradient-to-r from-accent to-accent-secondary px-3.5 py-1.5">
          <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-accent-foreground">
            {tag}
          </span>
        </span>

        <h2
          className={`select-text mt-5 font-display text-3xl leading-[1.15] tracking-[-0.01em] ${
            compact ? "shell:mt-3 shell:text-xl" : "lg:mt-3 lg:text-2xl"
          }`}
        >
          {title}
        </h2>

        <div
          className={`mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] uppercase tracking-[0.1em] ${META_OPACITY[surface]} ${
            compact ? "shell:mt-2 shell:text-[10px]" : "lg:mt-2 lg:text-[10px]"
          }`}
        >
          {meta.map((item, i) => (
            <span key={i}>{item}</span>
          ))}
        </div>

        <div
          className={`mt-7 flex flex-wrap items-center gap-3 ${
            compact ? "shell:mt-3 shell:gap-2" : "lg:mt-4 lg:gap-2"
          }`}
        >
          <button
            onClick={onPrimary}
            className={`h-11 rounded-xl bg-gradient-to-r from-accent to-accent-secondary px-5 text-sm font-medium text-accent-foreground transition-all duration-200 hover:shadow-accent-lg hover:brightness-110 active:scale-[0.98] ${
              compact ? "shell:h-9 shell:rounded-lg shell:px-4 shell:text-xs" : "lg:h-9 lg:rounded-lg lg:px-4 lg:text-xs"
            }`}
          >
            {primaryLabel}
          </button>
          <button
            onClick={onSecondary}
            className={`h-11 rounded-xl px-4 text-sm transition-colors ${SECONDARY_OPACITY[surface]} ${
              compact ? "shell:h-9 shell:px-4 shell:text-xs" : "lg:h-9 lg:px-4 lg:text-xs"
            }`}
          >
            {secondaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
