export const DURATIONS = [15, 30, 60, 120] as const;
export type Duration = (typeof DURATIONS)[number];

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

export type Task = {
  id: string;
  title: string;
  notes?: string;
  projectId?: string;
  tags: string[];
  /** Local YYYY-MM-DD: the day you intend to *do* this, not a deadline. */
  scheduled: string;
  /** Optional local HH:MM (24h). */
  dueTime?: string;
  minutes: Duration;
  priority: Priority;
  status: Status;
  recurrence?: Recurrence;
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
  tags?: string[];
  scheduled: string;
  dueTime?: string;
  minutes: Duration;
  priority: Priority;
  recurrence?: Recurrence;
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
