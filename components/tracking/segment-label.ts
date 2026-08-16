import type { Activity, Category, Segment, Task } from "@/lib/types";

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
