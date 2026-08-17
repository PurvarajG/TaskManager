/** The six dashboard modules, in their seeded default order. Shared by the dashboard and its settings page. */
export const MODULE_TITLE: Record<string, string> = {
  now: "Now",
  unaccounted: "Unaccounted",
  ribbon: "Day ribbon",
  rollups: "Roll-ups",
  signals: "Signals",
  records: "Records",
};

/** Which dashboard column a module lands in at ≥lg. Below that the grid collapses
 *  and both lists stack in moduleOrder sequence. */
export const MODULE_COLUMN: Record<string, "main" | "side"> = {
  now: "main", unaccounted: "main", records: "main",
  ribbon: "side", rollups: "side", signals: "side",
};
