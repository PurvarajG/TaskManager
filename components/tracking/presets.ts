import type { Activity, Category } from "@/lib/types";

export type PresetChip = { activity: Activity; category: Category };

/**
 * Preset activities eligible for quick-start chips, split into `pinned` (the
 * short row shown by default) and `rest` (behind "Show all"). If nothing is
 * pinned yet, the first five presets stand in so the card is never empty.
 */
export function presetChips(
  activities: Activity[],
  categories: Category[],
): { pinned: PresetChip[]; rest: PresetChip[] } {
  const chips = activities
    .filter((a) => a.isPreset && !a.archived)
    .map((a) => ({ activity: a, category: categories.find((c) => c.id === a.categoryId) }))
    .filter((p): p is PresetChip => !!p.category);

  const pinned = chips.filter((c) => c.activity.pinned);
  const rest = chips.filter((c) => !c.activity.pinned);

  if (pinned.length === 0) {
    return { pinned: chips.slice(0, 5), rest: chips.slice(5) };
  }
  return { pinned, rest };
}
