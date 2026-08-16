/**
 * Quick-pick estimates only. A task can be any whole number of minutes — some
 * are miniprojects that run for days — so these are shortcuts, not a closed set.
 */
export const DURATIONS = [15, 30, 60, 120, 240, 480] as const;
export type Duration = number;

export type Priority = 0 | 1 | 2 | 3;
export type Status = "open" | "done" | "trashed";

export type RecurrenceFreq = "daily" | "weekly" | "monthly";
export type Recurrence = {
  freq: RecurrenceFreq;
  interval: number;
};

export type Subtask = {
  id: string;
  taskId: string;
  title: string;
  done: boolean;
  sortOrder: number;
};

/**
 * What a column *means*, independent of what the user renamed it to. Progress,
 * blocked counts, and completion all read `kind`, never the visible name.
 */
export type StageKind = "backlog" | "active" | "blocked" | "done";

export const STAGE_KINDS: StageKind[] = ["backlog", "active", "blocked", "done"];

export type ProjectStage = {
  id: string;
  projectId: string;
  name: string;
  kind: StageKind;
  sortOrder: number;
  createdAt: string;
};

export type StageInput = {
  name: string;
  kind: StageKind;
};

/** Created with every new project, and backfilled onto existing ones. */
export const DEFAULT_STAGES: StageInput[] = [
  { name: "Backlog", kind: "backlog" },
  { name: "In Progress", kind: "active" },
  { name: "Blocked", kind: "blocked" },
  { name: "Done", kind: "done" },
];

export type Task = {
  id: string;
  title: string;
  notes?: string;
  projectId?: string;
  /** Always a stage of `projectId`; absent when the task has no project. */
  stageId?: string;
  boardOrder: number;
  tags: string[];
  /** Local YYYY-MM-DD: the day you intend to *do* this, not a deadline. */
  scheduled: string;
  /** Optional local HH:MM (24h). Never set alongside `isComplex`. */
  dueTime?: string;
  minutes: Duration;
  priority: Priority;
  status: Status;
  recurrence?: Recurrence;
  /** Spans multiple days from `scheduled` to `finishDate` instead of a single day. */
  isComplex: boolean;
  /** Local YYYY-MM-DD, `>= scheduled`. Only meaningful when `isComplex`. */
  finishDate?: string;
  sortOrder: number;
  createdAt: string;
  completedAt?: string;
  deletedAt?: string;
  subtasks: Subtask[];
};

export type TaskInput = {
  title: string;
  notes?: string;
  projectId?: string;
  stageId?: string;
  tags?: string[];
  scheduled: string;
  dueTime?: string;
  minutes: Duration;
  priority: Priority;
  recurrence?: Recurrence;
  /** Defaults to false on create. */
  isComplex?: boolean;
  finishDate?: string;
};

export type Project = {
  id: string;
  name: string;
  color: string;
  archived: boolean;
  sortOrder: number;
  createdAt: string;
};

export type ProjectInput = {
  name: string;
  color?: string;
};

/** There is exactly one general note, and this is its primary key. */
export const GENERAL_NOTE_ID = "owner";

export type GeneralNote = {
  body: string;
  updatedAt: string;
};

/** A scratch checklist item. Deliberately not a Task — it can graduate into one. */
export type QuickTodo = {
  id: string;
  title: string;
  done: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type TimeEntry = {
  id: string;
  taskId: string;
  startedAt: string;
  /** Absent while the timer is still running. */
  endedAt?: string;
  /** Whole minutes, minimum 1. Absent while running. */
  minutes?: number;
  note?: string;
  createdAt: string;
  updatedAt: string;
};

/** A stopped timer always records at least this much, so a quick task still counts. */
export const MIN_TRACKED_MINUTES = 1;

/** After this many days sitting undone, a task stops nagging and asks to be dropped. */
export const STALE_AFTER_DAYS = 7;

/** Nothing gets scheduled past this hour, so capacity means something. */
export const DAY_END_HOUR = 22;

export const PROJECT_COLORS = [
  "#0052ff",
  "#7c3aed",
  "#db2777",
  "#dc2626",
  "#ea580c",
  "#16a34a",
  "#0891b2",
] as const;

// ── Time tracking lab ────────────────────────────────────────────────────

/** What a category *means*, independent of its name — summaries read this, never the name. */
export type CategoryKind = "work" | "rest" | "upkeep" | "unclassified";

export type SegmentSource = "timer" | "manual" | "backfill";

export type Category = {
  id: string;
  name: string;
  color: string;
  kind: CategoryKind;
  sortOrder: number;
  archived: boolean;
  createdAt: string;
};

export type CategoryInput = {
  name: string;
  color: string;
  kind: CategoryKind;
};

export type Activity = {
  id: string;
  categoryId: string;
  name: string;
  typicalMinutes?: number;
  isPreset: boolean;
  sortOrder: number;
  archived: boolean;
  createdAt: string;
};

export type ActivityInput = {
  categoryId: string;
  name: string;
  typicalMinutes?: number;
  isPreset?: boolean;
};

/** The continuous life timeline. Exactly one of `taskId` / `activityId` is ever set. */
export type Segment = {
  id: string;
  startedAt: string;
  /** Absent while running. */
  endedAt?: string;
  categoryId: string;
  activityId?: string;
  taskId?: string;
  note?: string;
  source: SegmentSource;
  createdAt: string;
  updatedAt: string;
};

/** Derived on read, never persisted — the whole point is that nothing has to run overnight. */
export type Gap = {
  startedAt: string;
  endedAt: string;
  minutes: number;
};

export type TrackingSettings = {
  dayStartHour: number;
  wakingStartHour: number;
  wakingEndHour: number;
  minGapMinutes: number;
  moduleOrder: string[];
  hiddenModules: string[];
  updatedAt: string;
};

/** There is exactly one tracking-settings row, and this fixed uuid is its primary key. */
export const TRACKING_SETTINGS_ID = "00000000-0000-0000-0000-000000000001";

/**
 * Fixed rather than looked up by name: task-linked segments (started from a
 * task's own timer button, not the tracking dashboard) default into this
 * category, and it must keep working even after the user renames "Focus Work".
 */
export const FOCUS_WORK_CATEGORY_ID = "00000000-0000-0000-0000-000000000002";

/** Starting points seeded once, on an empty `categories` table — fully user-editable after. */
export const DEFAULT_CATEGORIES: CategoryInput[] = [
  { name: "Focus Work", color: "cat-indigo", kind: "work" },
  { name: "Admin", color: "cat-slate", kind: "upkeep" },
  { name: "Sleep", color: "cat-violet", kind: "rest" },
  { name: "Health", color: "cat-emerald", kind: "upkeep" },
  { name: "Travel", color: "cat-amber", kind: "upkeep" },
  { name: "Personal", color: "cat-rose", kind: "rest" },
  { name: "Unclassified", color: "cat-neutral", kind: "unclassified" },
];

/** Preset activities seeded once per default category, keyed by category name. */
export const DEFAULT_ACTIVITIES: Record<string, string[]> = {
  "Focus Work": ["Deep work", "Meetings", "Email"],
  Admin: ["Admin", "Finances", "Planning"],
  Sleep: ["Sleep", "Nap"],
  Health: ["Exercise", "Meals", "Hygiene"],
  Travel: ["Commute", "Travel"],
  Personal: ["Family", "Social", "Leisure"],
  Unclassified: [],
};
