import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import MonthGrid from "@/components/calendar/MonthGrid";
import DayPanel from "@/components/calendar/DayPanel";
import TaskPanel from "@/components/TaskPanel";
import { monthGrid } from "@/lib/calendar";
import { emptyWorkspace, makeProject, makeTask, renderWorkspace } from "./harness";

const TODAY = "2026-03-10";
const task = makeTask({ scheduled: TODAY, title: "Ship the board" });
const project = makeProject();

function tasksByDate() {
  return new Map([[TODAY, [task]]]);
}

describe("month calendar", () => {
  test("renders the month with adjacent days present but muted", async () => {
    renderWorkspace(
      <MonthGrid
        days={monthGrid(2026, 2)}
        todayISO={TODAY}
        tasksByDate={tasksByDate()}
        onSelectDay={() => {}}
        onAnnounce={() => {}}
      />,
      emptyWorkspace({ tasks: [task], projects: [project] }),
    );

    // Every day is a labelled button, including the borrowed April days.
    expect(await screen.findByRole("button", { name: /2026-03-01/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /2026-04-01/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "2026-03-10, 1 task" })).toBeInTheDocument();
  });

  test("dragging a task marker to another date reschedules it and announces the move", async () => {
    const announcements: string[] = [];
    const { mock } = renderWorkspace(
      <MonthGrid
        days={monthGrid(2026, 2)}
        todayISO={TODAY}
        tasksByDate={tasksByDate()}
        onSelectDay={() => {}}
        onAnnounce={(m) => announcements.push(m)}
      />,
      emptyWorkspace({ tasks: [task], projects: [project] }),
    );

    const marker = (await screen.findByRole("button", { name: "Ship the board" }))
      .parentElement as HTMLElement;
    const targetCell = screen.getByRole("button", { name: /2026-03-12/ })
      .parentElement as HTMLElement;

    const dataTransfer = {
      effectAllowed: "",
      setData: () => {},
      getData: () => task.id,
    };

    // Each step is awaited separately: dispatching all three in one tick would
    // batch the state updates, and the drop handler would still see no drag.
    const fire = async (node: HTMLElement, type: string) => {
      node.dispatchEvent(
        Object.assign(new Event(type, { bubbles: true, cancelable: true }), { dataTransfer }),
      );
      await waitFor(() => {});
    };

    await fire(marker, "dragstart");
    await fire(targetCell, "dragover");
    await fire(targetCell, "drop");

    await waitFor(() =>
      expect(mock.calls).toContainEqual({
        url: `/api/tasks/${task.id}`,
        method: "PATCH",
        body: { scheduled: "2026-03-12" },
      }),
    );
    expect(announcements).toContain("Ship the board moved to 2026-03-12.");
  });
});

describe("month calendar — complex tasks", () => {
  const spanTask = makeTask({
    id: "44444444-4444-4444-8444-444444444444",
    scheduled: "2026-03-10",
    isComplex: true,
    finishDate: "2026-03-12",
    title: "Write the report",
  });

  function spanTasksByDate() {
    return new Map([
      ["2026-03-10", [spanTask]],
      ["2026-03-11", [spanTask]],
      ["2026-03-12", [spanTask]],
    ]);
  }

  test("a complex task is listed on every day in its range", async () => {
    renderWorkspace(
      <MonthGrid
        days={monthGrid(2026, 2)}
        todayISO={TODAY}
        tasksByDate={spanTasksByDate()}
        onSelectDay={() => {}}
        onAnnounce={() => {}}
      />,
      emptyWorkspace({ tasks: [spanTask], projects: [project] }),
    );

    for (const label of [/2026-03-10/, /2026-03-11/, /2026-03-12/]) {
      const button = await screen.findByRole("button", { name: label });
      expect(within(button.parentElement as HTMLElement).getByText("Write the report")).toBeInTheDocument();
    }
  });

  test("dragging a complex task's marker shifts the whole range, preserving span length", async () => {
    const { mock } = renderWorkspace(
      <MonthGrid
        days={monthGrid(2026, 2)}
        todayISO={TODAY}
        tasksByDate={spanTasksByDate()}
        onSelectDay={() => {}}
        onAnnounce={() => {}}
      />,
      emptyWorkspace({ tasks: [spanTask], projects: [project] }),
    );

    const markers = await screen.findAllByRole("button", { name: "Write the report" });
    const marker = markers[0].parentElement as HTMLElement;
    const targetCell = screen.getByRole("button", { name: /2026-03-15/ })
      .parentElement as HTMLElement;

    const dataTransfer = { effectAllowed: "", setData: () => {}, getData: () => spanTask.id };
    const fire = async (node: HTMLElement, type: string) => {
      node.dispatchEvent(
        Object.assign(new Event(type, { bubbles: true, cancelable: true }), { dataTransfer }),
      );
      await waitFor(() => {});
    };

    await fire(marker, "dragstart");
    await fire(targetCell, "dragover");
    await fire(targetCell, "drop");

    // Dragged the day-10 marker to the 15th: a 5-day shift, so the 2-day span
    // (10th->12th) becomes 15th->17th.
    await waitFor(() =>
      expect(mock.calls).toContainEqual({
        url: `/api/tasks/${spanTask.id}`,
        method: "PATCH",
        body: { scheduled: "2026-03-15", finishDate: "2026-03-17" },
      }),
    );
  });
});

describe("day panel", () => {
  test("lists the day's tasks and adds a new one on that date", async () => {
    const { mock } = renderWorkspace(
      <DayPanel iso={TODAY} tasks={[task]} onClose={() => {}} />,
      emptyWorkspace({ tasks: [task], projects: [project] }),
    );

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Ship the board" })).toBeInTheDocument();

    await userEvent.type(
      within(dialog).getByLabelText("Add a task on this day"),
      "Write the release note{Enter}",
    );

    await waitFor(() =>
      expect(mock.calls).toContainEqual({
        url: "/api/tasks",
        method: "POST",
        body: { text: "Write the release note", scheduled: TODAY },
      }),
    );
  });

  test("Move date is the accessible equivalent of dragging, and keeps the time", async () => {
    const timed = makeTask({ scheduled: TODAY, title: "Standup", dueTime: "09:30" });
    const { mock } = renderWorkspace(
      <DayPanel iso={TODAY} tasks={[timed]} onClose={() => {}} />,
      emptyWorkspace({ tasks: [timed] }),
    );

    await userEvent.click(await screen.findByRole("button", { name: "Move date" }));
    const field = screen.getByLabelText("New date for Standup");
    await userEvent.clear(field);
    await userEvent.type(field, "2026-03-18");

    await waitFor(() =>
      expect(mock.calls).toContainEqual({
        url: `/api/tasks/${timed.id}`,
        method: "PATCH",
        // Only the date is sent, so the 09:30 stays untouched.
        body: { scheduled: "2026-03-18" },
      }),
    );
  });

  test("an empty day offers task creation rather than a dead end", async () => {
    renderWorkspace(<DayPanel iso="2026-03-22" tasks={[]} onClose={() => {}} />, emptyWorkspace());

    expect(await screen.findByText(/Nothing scheduled/)).toBeInTheDocument();
    expect(screen.getByLabelText("Add a task on this day")).toBeInTheDocument();
  });

  test("selecting a task opens the shared task panel", async () => {
    renderWorkspace(
      <>
        <DayPanel iso={TODAY} tasks={[task]} onClose={() => {}} />
        <TaskPanel />
      </>,
      emptyWorkspace({ tasks: [task] }),
    );

    await userEvent.click(await screen.findByRole("button", { name: "Ship the board" }));
    expect(await screen.findByRole("dialog", { name: "Task" })).toBeInTheDocument();
  });
});
