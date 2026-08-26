"use client";

import CategoryDot from "./CategoryDot";

/**
 * The activity quick-start button — the prototype's `.pill` treatment
 * (bordered, card-background, compact). Shared by `NowModule`'s quick-start
 * row and `UnaccountedModule`'s per-gap fill row, which previously
 * duplicated this exact button markup.
 */
export default function ActivityPill({
  color,
  name,
  active = false,
  onClick,
}: {
  color: string;
  name: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={active}
      className={`flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors sm:min-h-9 ${
        active ? "border-accent/40 bg-accent/10 text-accent" : "border-border bg-card hover:border-accent/30"
      }`}
    >
      <CategoryDot color={color} />
      {name}
    </button>
  );
}
