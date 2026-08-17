import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import TimerStrip from "@/components/TimerStrip";
import TimerConflict from "@/components/TimerConflict";
import TaskTime from "@/components/TaskTime";
import { emptyWorkspace, makeTask, renderWorkspace } from "./harness";
import type { TimeEntry } from "@/lib/types";

const taskA = makeTask({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", title: "Write the plan" });
const taskB = makeTask({ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", title: "Fix the nav" });

function entry(taskId: string, overrides: Partial<TimeEntry> = {}): TimeEntry {
  return {
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    taskId,
    categoryId: "00000000-0000-0000-0000-000000000002",
    startedAt: new Date(Date.now() - 90_000).toISOString(),
    createdAt: "2026-03-01T09:00:00.000Z",
    updatedAt: "2026-03-01T09:00:00.000Z",
    ...overrides,
  };
}

describe("running timer strip", () => {
  test("stays hidden when nothing is running", async () => {
    renderWorkspace(<TimerStrip />, emptyWorkspace({ tasks: [taskA] }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Stop" })).not.toBeInTheDocument());
  });

  test("names the running task, shows elapsed time, and stops from anywhere", async () => {
    const running = entry(taskA.id);
    const { mock } = renderWorkspace(
      <TimerStrip />,
      emptyWorkspace({ tasks: [taskA, taskB], timeEntries: [running], running }),
    );

    expect(await screen.findByRole("button", { name: "Write the plan" })).toBeInTheDocument();
    expect(screen.getByText(/^\d{2}:\d{2}$/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Stop" }));
    await waitFor(() =>
      expect(mock.calls).toContainEqual({
        url: "/api/time-entries/stop",
        method: "POST",
        body: undefined,
      }),
    );
  });
});

describe("timer conflicts", () => {
  test("a second start identifies the running task and offers one hand-off", async () => {
    const running = entry(taskA.id);
    const { mock } = renderWorkspace(
      <>
        <TaskTime task={taskB} />
        <TimerConflict />
      </>,
      emptyWorkspace({ tasks: [taskA, taskB], timeEntries: [running], running }),
    );

    mock.failNext("/api/time-entries", 409, "Another task is already being timed", {
      runningTaskId: taskA.id,
    });
    await userEvent.click(await screen.findByRole("button", { name: "Start timer" }));

    const dialog = await screen.findByRole("alertdialog", { name: "A timer is already running" });
    expect(dialog).toHaveTextContent("Write the plan");

    mock.respondNext(
      "/api/time-entries",
      {
        stopped: { ...running, endedAt: new Date().toISOString(), minutes: 2 },
        started: entry(taskB.id, { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" }),
      },
      "POST",
    );
    await userEvent.click(screen.getByRole("button", { name: /Stop it and start/ }));
    await waitFor(() =>
      expect(mock.calls).toContainEqual({
        url: "/api/time-entries",
        method: "POST",
        // One atomic request, not a stop followed by a start.
        body: { taskId: taskB.id, replaceRunning: true },
      }),
    );
  });

  test("keeping the current timer dismisses the prompt without starting anything", async () => {
    const running = entry(taskA.id);
    const { mock } = renderWorkspace(
      <>
        <TaskTime task={taskB} />
        <TimerConflict />
      </>,
      emptyWorkspace({ tasks: [taskA, taskB], timeEntries: [running], running }),
    );
    mock.failNext("/api/time-entries", 409, "Another task is already being timed", {
      runningTaskId: taskA.id,
    });

    await userEvent.click(await screen.findByRole("button", { name: "Start timer" }));
    await userEvent.click(await screen.findByRole("button", { name: "Keep going" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(mock.calls.filter((c) => c.body && "replaceRunning" in (c.body as object))).toHaveLength(0);
  });
});

describe("task time totals", () => {
  test("estimate versus recorded counts only stopped entries", async () => {
    const running = entry(taskA.id, { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" });
    const stopped = entry(taskA.id, {
      startedAt: "2026-03-01T09:00:00.000Z",
      endedAt: "2026-03-01T09:25:00.000Z",
      minutes: 25,
    });

    renderWorkspace(
      <TaskTime task={taskA} />,
      emptyWorkspace({ tasks: [taskA], timeEntries: [stopped, running], running }),
    );

    // 25m recorded of a 30m estimate — the live timer is displayed, not summed.
    expect(await screen.findByText(/25m of 30m/)).toBeInTheDocument();
  });

  test("a manual entry records time that was never timed", async () => {
    const { mock } = renderWorkspace(<TaskTime task={taskA} />, emptyWorkspace({ tasks: [taskA] }));

    await userEvent.click(await screen.findByRole("button", { name: "+ Record time manually" }));
    const minutes = screen.getByLabelText("Minutes");
    await userEvent.clear(minutes);
    await userEvent.type(minutes, "45");
    await userEvent.click(screen.getByRole("button", { name: "Record" }));

    await waitFor(() => {
      const call = mock.calls.find((c) => c.url === "/api/time-entries");
      expect((call?.body as { minutes: number })?.minutes).toBe(45);
    });
  });
});
