import type { Activity, Category, Project, Segment, Task } from "@/lib/types";

/** What a segment is called, in the order that actually names it: the specific thing over the bucket it's in. */
export function segmentLabel(
  segment: Pick<Segment, "activityId" | "taskId" | "categoryId">,
  categories: Category[],
  activities: Activity[],
  tasks: Task[],
): string {
  const activity = activities.find((a) => a.id === segment.activityId);
  if (activity) return activity.name;
  const task = tasks.find((t) => t.id === segment.taskId);
  if (task) return task.title;
  return categories.find((c) => c.id === segment.categoryId)?.name ?? "Untitled";
}

export type SegmentSubject = {
  label: string;
  /** Present only when the segment is task-linked and the task still exists. */
  task?: Task;
  /** The task's project, when it has one — lets a caller show a dot/name alongside the label. */
  project?: Project;
};

/** Same resolution order as segmentLabel, plus the project a task-linked segment belongs to. */
export function segmentSubject(
  segment: Pick<Segment, "activityId" | "taskId" | "categoryId">,
  categories: Category[],
  activities: Activity[],
  tasks: Task[],
  projects: Project[],
): SegmentSubject {
  const activity = activities.find((a) => a.id === segment.activityId);
  if (activity) return { label: activity.name };
  const task = tasks.find((t) => t.id === segment.taskId);
  if (task) {
    const project = task.projectId ? projects.find((p) => p.id === task.projectId) : undefined;
    return { label: task.title, task, project };
  }
  return { label: categories.find((c) => c.id === segment.categoryId)?.name ?? "Untitled" };
}
