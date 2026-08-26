import SectionLabel from "@/components/SectionLabel";

/**
 * The one full-height, independently-scrolling page frame every route
 * shares. Today improvised this inline (a flex column, full-viewport
 * height, and a clipped overflow, all gated on a desktop breakpoint)
 * before this component existed; every page now goes through here instead
 * of hand-rolling its own padding/rhythm.
 *
 * Every frame rule below uses the `shell:` variant (defined in globals.css
 * as an `@media (min-width: 900px)` at-rule), NOT Tailwind's stock `lg:`
 * (1024px). The Electron window's real minWidth is 900 (electron/main.js)
 * — a size the user can actually reach — so gating the frame at 1024 left a
 * dead band where the shell silently fell back to ordinary document flow
 * (window scroll, stacked rail, uncompacted header) inside a window too
 * short to fit any of it.
 *
 * The two-column rail grid needs MORE room than that: at the 900px minimum
 * the sidebar + shell padding alone leave ~611px, which can't hold both a
 * primary column with a real floor and the rail token width side by side.
 * So the rail grid only engages at the wider `rail:` variant (1200px,
 * comfortably past the ~1141px arithmetic floor — see globals.css for the
 * numbers); from 900px up to that point the rail stacks BELOW the primary
 * column inside the shell's own scrolling region instead of sitting beside
 * it in a grid that can't fit. Below 900px there's no shell frame at all —
 * ordinary document flow, window scroll, single stacked column.
 *
 * Density is chosen per page via `maxWidth` — this does NOT force pages
 * wider. A narrow `max-w-3xl` list on a 4K display is correct; only a page
 * whose content genuinely wants the room (Calendar's grid, Today and
 * Tracking's two-column layouts) passes something wider.
 *
 * `actions` and `label` land in the header, which can fall inside
 * AppChrome's top 36px drag band at the compact `shell:py-4` rhythm —
 * SectionLabel already opts itself out of the drag region, and `actions`
 * is wrapped in `.no-drag` here so callers don't have to remember it per
 * page.
 *
 * Header language (Phase 2, design-prototypes/tempo-focus/index.html's
 * `.topline`/`.eyebrow`/`h1`/`.subtitle`): `label` now renders through
 * SectionLabel's bordered `variant="eyebrow"` pill instead of the plain
 * accent-tinted one, followed by the serif `h1`, then the optional
 * `subtitle` line, then `headerExtra`. Only this header render path
 * changed — `label`, `pulse`, `actions`, `headerExtra`, `rail`,
 * `maxWidth` and `workspaceTestId` all keep their exact prop shape and
 * behaviour.
 */
export default function PageShell({
  label,
  pulse = false,
  title,
  subtitle,
  actions,
  headerExtra,
  rail,
  maxWidth = "max-w-3xl",
  workspaceTestId = "page-shell-workspace",
  children,
}: {
  label: React.ReactNode;
  pulse?: boolean;
  title: React.ReactNode;
  /** Optional single line under the h1 — true, route-specific context, not
   *  marketing copy. Rendered before `headerExtra`. */
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  /** Extra header content below the title — stats rows, a progress bar, a
   *  subtitle — before the scrolling body begins. */
  headerExtra?: React.ReactNode;
  /** An optional side rail. From the `rail:` breakpoint (1200px) up, the
   *  body becomes a two-column grid sharing the shell's remaining height,
   *  with both panes scrolling on their own — each pane is `rail:min-h-0
   *  rail:overflow-y-auto` inside a grid row held to `minmax(0,1fr)` with
   *  the default `stretch` alignment, so a pane's box is the ROW's height,
   *  not its own content's height; `align-items` must never be overridden
   *  to `start` here; that resolves each item to content height instead,
   *  which can never overflow, which makes the per-pane `overflow-y-auto`
   *  permanently inert. Below `rail:` — including the 900-1199px band,
   *  where a side-by-side grid can't fit without overflowing — the rail
   *  stacks under the primary column instead, inside the shell's own
   *  `shell:overflow-y-auto` scrolling region (which is itself switched
   *  off at `rail:`, via `rail:overflow-hidden`, so the two scroll
   *  mechanisms — outer shared scroll below 1200px, inner independent
   *  panes at/above it — never both apply to the same element at once).
   *  Rail width (once the grid is active) is the shared `--width-rail`
   *  token. */
  rail?: React.ReactNode;
  maxWidth?: string;
  /** Overrides the workspace container's data-testid (defaults to "page-shell-workspace"). */
  workspaceTestId?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`mx-auto w-full px-6 py-12 sm:px-10 sm:py-16 shell:flex shell:h-dvh shell:flex-col shell:overflow-hidden shell:px-8 shell:py-4 xl:px-10 ${maxWidth}`}
    >
      <header className="shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionLabel variant="eyebrow" pulse={pulse}>
            {label}
          </SectionLabel>
          {actions && <div className="no-drag flex flex-wrap items-center gap-2">{actions}</div>}
        </div>

        <h1 className="mt-5 font-display text-4xl leading-[1.1] tracking-[-0.02em] sm:text-5xl shell:mt-3 shell:text-3xl">
          {title}
        </h1>

        {subtitle && (
          <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-muted-foreground shell:mt-1.5">
            {subtitle}
          </p>
        )}

        {headerExtra}
      </header>

      <div
        data-testid={rail ? workspaceTestId : undefined}
        className={`mt-10 grid grid-cols-1 gap-10 shell:mt-5 shell:min-h-0 shell:flex-1 shell:overflow-y-auto${
          rail
            ? " rail:grid-cols-[minmax(28rem,1fr)_var(--width-rail)] rail:grid-rows-[minmax(0,1fr)] rail:gap-x-6 rail:overflow-hidden"
            : ""
        }`}
      >
        <div className={rail ? "min-w-0 rail:min-h-0 rail:overflow-y-auto rail:pr-1" : "min-w-0"}>
          {children}
        </div>
        {rail && (
          <aside className="min-w-0 space-y-10 shell:space-y-5 rail:min-h-0 rail:overflow-y-auto rail:pr-1">
            {rail}
          </aside>
        )}
      </div>
    </div>
  );
}
