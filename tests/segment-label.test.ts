import assert from "node:assert/strict";
import test from "node:test";
import { segmentLabel, segmentSubject } from "../components/tracking/segment-label";
import type { Activity, Category, Project, Segment, Task } from "../lib/types";

const now = "2026-01-01T00:00:00.000Z";

const categories: Category[] = [
  { id: "cat-1", name: "Focus Work", color: "cat-indigo", kind: "work", sortOrder: 0, archived: false, createdAt: now },
];
const activities: Activity[] = [
  { id: "act-1", categoryId: "cat-1", name: "Deep work", isPreset: true, pinned: false, sortOrder: 0, archived: false, createdAt: now },
];
const projects: Project[] = [
  { id: "proj-1", name: "Atlas Launch", color: "#0052ff", archived: false, sortOrder: 0, createdAt: now },
];
const tasks: Task[] = [
  {
    id: "task-1",
    title: "Prep the client deck",
    projectId: "proj-1",
    boardOrder: 0,
    tags: [],
    scheduled: "2026-01-01",
    minutes: 30,
    priority: 0,
    status: "open",
    isComplex: false,
    sortOrder: 0,
    createdAt: now,
    subtasks: [],
  },
];

function segment(patch: Partial<Segment>): Pick<Segment, "activityId" | "taskId" | "categoryId"> {
  return { activityId: undefined, taskId: undefined, categoryId: "cat-1", ...patch };
}

test("segmentLabel prefers the activity, then the task, then falls back to the category", () => {
  assert.equal(segmentLabel(segment({ activityId: "act-1" }), categories, activities, tasks), "Deep work");
  assert.equal(segmentLabel(segment({ taskId: "task-1" }), categories, activities, tasks), "Prep the client deck");
  assert.equal(segmentLabel(segment({}), categories, activities, tasks), "Focus Work");
});

test("segmentSubject carries the task's project alongside the label", () => {
  const subject = segmentSubject(segment({ taskId: "task-1" }), categories, activities, tasks, projects);
  assert.equal(subject.label, "Prep the client deck");
  assert.equal(subject.task?.id, "task-1");
  assert.equal(subject.project?.name, "Atlas Launch");
});

test("segmentSubject has no project for an activity segment or a task with no project", () => {
  const activitySubject = segmentSubject(segment({ activityId: "act-1" }), categories, activities, tasks, projects);
  assert.equal(activitySubject.project, undefined);

  const orphanTask: Task = { ...tasks[0], id: "task-2", projectId: undefined };
  const subject = segmentSubject(segment({ taskId: "task-2" }), categories, activities, [orphanTask], projects);
  assert.equal(subject.task?.id, "task-2");
  assert.equal(subject.project, undefined);
});
