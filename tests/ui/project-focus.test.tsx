import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import ProjectPage from "@/app/projects/[id]/page";
import { toISODate } from "@/lib/parse";
import { shiftDays } from "@/lib/summary";
import { emptyWorkspace, makeProject, makeStages, makeTask, renderWorkspace } from "./harness";

const project = makeProject();
const stages = makeStages(project.id);

// ProjectPage derives todayISO from `new Date()` directly, so fixtures below
// are built relative to the real clock instead of a fixed date.
const TODAY = toISODate(new Date());
const OVERDUE = shiftDays(TODAY, -9);
const FUTURE = shiftDays(TODAY, 30);

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "22222222-2222-4222-8222-222222222222" }),
}));

describe("project workspace focus band", () => {
  test("focuses the highest-priority due-today/overdue open task and can mark it done", async () => {
    const overdue = makeTask({
      id: "task-overdue",
      title: "Confirm moving inventory",
      projectId: project.id,
      stageId: stages[1].id,
      scheduled: OVERDUE,
      priority: 1,
    });
    const lowerPriority = makeTask({
      id: "task-low",
      title: "Low priority today",
      projectId: project.id,
      stageId: stages[1].id,
      scheduled: TODAY,
      priority: 3,
    });

    const workspace = emptyWorkspace({
      tasks: [overdue, lowerPriority],
      projects: [project],
      stages,
    });
    const { mock } = renderWorkspace(<ProjectPage />, workspace);
    mock.respondWith("/complete", {
      task: { ...overdue, status: "done", completedAt: `${TODAY}T00:00:00.000Z` },
      next: null,
    });

    expect((await screen.findAllByText("Confirm moving inventory")).length).toBeGreaterThan(0);
    expect(screen.getByText("Current focus")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Mark done/ }));
    await waitFor(() => {
      expect(mock.calls).toContainEqual({
        url: `/api/tasks/${overdue.id}/complete`,
        method: "POST",
        body: undefined,
      });
    });
  });

  test("focuses the running task even when it isn't due today", async () => {
    const running = makeTask({
      id: "task-running",
      title: "Timed right now",
      projectId: project.id,
      stageId: stages[1].id,
      scheduled: FUTURE,
    });
    const dueToday = makeTask({
      id: "task-due",
      title: "Due today instead",
      projectId: project.id,
      stageId: stages[1].id,
      scheduled: TODAY,
      priority: 1,
    });

    const workspace = emptyWorkspace({
      tasks: [running, dueToday],
      projects: [project],
      stages,
      running: {
        id: "entry-1",
        taskId: running.id,
        categoryId: "cat",
        startedAt: `${TODAY}T09:00:00.000Z`,
        createdAt: `${TODAY}T09:00:00.000Z`,
        updatedAt: `${TODAY}T09:00:00.000Z`,
      },
    });
    renderWorkspace(<ProjectPage />, workspace);

    // Appears once as the focus card's heading and once on its board card.
    expect((await screen.findAllByText("Timed right now")).length).toBeGreaterThan(0);
    expect(screen.getByText("Timing now")).toBeInTheDocument();
  });

  test("lists overdue and stalled-waiting tasks under Needs attention", async () => {
    const overdue = makeTask({
      id: "task-overdue-2",
      title: "Six days late",
      projectId: project.id,
      stageId: stages[1].id,
      scheduled: OVERDUE,
    });
    const stalledWaiting = makeTask({
      id: "task-waiting",
      title: "Ganesh interludes",
      projectId: project.id,
      stageId: stages[2].id, // the "Blocked" (waiting-kind) stage
      scheduled: OVERDUE,
    });

    const workspace = emptyWorkspace({
      tasks: [overdue, stalledWaiting],
      projects: [project],
      stages,
    });
    renderWorkspace(<ProjectPage />, workspace);

    expect(await screen.findByText("Needs attention")).toBeInTheDocument();
    // Both tasks also appear as board cards, so a title can legitimately
    // appear twice — once in the attention list, once on the board.
    expect(screen.getAllByText("Six days late").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Ganesh interludes").length).toBeGreaterThan(0);
    expect(screen.getByText(/Waiting with no follow-up date/)).toBeInTheDocument();
  });

  test("shows a quiet placeholder and no attention items when nothing needs a decision", async () => {
    const fine = makeTask({
      id: "task-fine",
      title: "Not due for a while",
      projectId: project.id,
      stageId: stages[1].id,
      scheduled: FUTURE,
    });
    const workspace = emptyWorkspace({
      tasks: [fine],
      projects: [project],
      stages,
    });
    renderWorkspace(<ProjectPage />, workspace);

    await screen.findByText(project.name);
    expect(screen.queryByText("Current focus")).not.toBeInTheDocument();
    expect(screen.queryByText("Needs attention")).not.toBeInTheDocument();
  });

  test("the board, its columns, and their counts still render alongside the focus band", async () => {
    const task = makeTask({
      id: "task-board",
      projectId: project.id,
      stageId: stages[0].id,
      scheduled: TODAY,
    });
    const workspace = emptyWorkspace({
      tasks: [task],
      projects: [project],
      stages,
    });
    renderWorkspace(<ProjectPage />, workspace);

    expect(await screen.findByRole("region", { name: "Backlog, 1 task" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "In Progress, 0 tasks" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Blocked, 0 tasks" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Done, 0 tasks" })).toBeInTheDocument();
  });
});
