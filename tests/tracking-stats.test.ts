import assert from "node:assert/strict";
import test from "node:test";
import { minutesByProject } from "../lib/tracking-stats";
import type { Project, Segment, Task } from "../lib/types";

const now = new Date("2026-01-01T12:00:00.000Z");

const projects: Project[] = [
  { id: "proj-1", name: "Atlas Launch", color: "#0052ff", archived: false, sortOrder: 0, createdAt: "2026-01-01T00:00:00.000Z" },
  { id: "proj-2", name: "Homebase", color: "#ff0000", archived: false, sortOrder: 1, createdAt: "2026-01-01T00:00:00.000Z" },
];

const tasks: Task[] = [
  {
    id: "task-1",
    title: "Atlas task",
    projectId: "proj-1",
    boardOrder: 0,
    tags: [],
    scheduled: "2026-01-01",
    minutes: 30,
    priority: 0,
    status: "open",
    isComplex: false,
    sortOrder: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    subtasks: [],
  },
  {
    id: "task-2",
    title: "Projectless task",
    boardOrder: 0,
    tags: [],
    scheduled: "2026-01-01",
    minutes: 30,
    priority: 0,
    status: "open",
    isComplex: false,
    sortOrder: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    subtasks: [],
  },
];

function segment(patch: Partial<Segment>): Segment {
  return {
    id: crypto.randomUUID(),
    startedAt: "2026-01-01T09:00:00.000Z",
    endedAt: "2026-01-01T10:00:00.000Z",
    categoryId: "cat-1",
    source: "manual",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...patch,
  };
}

test("minutesByProject groups task-linked segments through the task's project", () => {
  const rows = minutesByProject(
    [
      segment({ taskId: "task-1" }),
      segment({ taskId: "task-2" }),
      segment({ activityId: "act-1", taskId: undefined }),
    ],
    tasks,
    projects,
    now,
  );

  const atlas = rows.find((r) => r.project?.id === "proj-1");
  const noProject = rows.find((r) => r.project === null);
  assert.equal(atlas?.minutes, 60);
  assert.equal(noProject?.minutes, 60, "a task with no project lands in the No project bucket");
  assert.equal(rows.some((r) => r.project?.id === "proj-2"), false, "an untracked project contributes nothing");
  assert.equal(
    rows.reduce((sum, r) => sum + r.minutes, 0),
    120,
    "the activity-only segment is excluded entirely",
  );
});

test("minutesByProject counts a running task segment up to now", () => {
  const rows = minutesByProject(
    [segment({ taskId: "task-1", startedAt: "2026-01-01T11:30:00.000Z", endedAt: undefined })],
    tasks,
    projects,
    now,
  );
  assert.equal(rows[0].minutes, 30);
});
