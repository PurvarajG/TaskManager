import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import Today from "@/components/Today";
import DashboardTimeline from "@/components/today/DashboardTimeline";
import TaskPanel from "@/components/TaskPanel";
import { emptyWorkspace, makeProject, makeTask, renderWorkspace } from "./harness";

vi.mock("@/lib/useNow", () => ({
  useNow: () => new Date("2026-08-14T12:00:00"),
}));

describe("Today dashboard timeline", () => {
  test("renders a seven-day span and changes it with the range control", async () => {
    renderWorkspace(<DashboardTimeline todayISO="2026-08-14" />);

    expect(screen.getByText("7 days")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Timeline range"), { target: { value: "0" } });
    expect(screen.getByText("1 day")).toBeInTheDocument();
  });

  test("keeps the slider track progress in sync with its selected snap point", () => {
    renderWorkspace(<DashboardTimeline todayISO="2026-08-14" />);

    const slider = screen.getByLabelText("Timeline range");
    expect(slider).toHaveClass("timeline-range");
    expect(slider).toHaveStyle({ "--range-progress": "66.66666666666666%" });

    fireEvent.change(slider, { target: { value: "6" } });
    expect(slider).toHaveStyle({ "--range-progress": "100%" });
  });

  test("moves by the selected span and links unused days to the calendar", async () => {
    renderWorkspace(<DashboardTimeline todayISO="2026-08-14" />);

    fireEvent.change(screen.getByLabelText("Timeline range"), { target: { value: "0" } });
    await userEvent.click(screen.getByRole("button", { name: "Next 1 day" }));

    expect(screen.getByRole("link", { name: "Open calendar for 2026-08-15" })).toHaveAttribute(
      "href",
      "/calendar?date=2026-08-15",
    );
  });

  test("positions timed tasks by their due time and duration", async () => {
    const task = makeTask({
      scheduled: "2026-08-14",
      dueTime: "10:00",
      minutes: 60,
      title: "Time-boxed work",
    });
    const view = renderWorkspace(
      <DashboardTimeline todayISO="2026-08-14" />,
      emptyWorkspace({ tasks: [task] }),
    );

    await screen.findByRole("button", { name: "Time-boxed work" });
    fireEvent.change(screen.getByLabelText("Timeline range"), { target: { value: "0" } });

    expect(view.container.querySelector('[data-testid="timeline-bar"]')).toHaveStyle({
      left: "14.285714285714285%",
      width: "7.142857142857142%",
    });
  });

  test("collects untimed work in an unscheduled strip", async () => {
    const task = makeTask({ scheduled: "2026-08-14", title: "Plan the week" });
    renderWorkspace(<DashboardTimeline todayISO="2026-08-14" />, emptyWorkspace({ tasks: [task] }));

    expect(await screen.findByRole("button", { name: "Plan the week" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Timeline range"), { target: { value: "0" } });
    expect(screen.getByLabelText("Unscheduled tasks for 2026-08-14")).toBeInTheDocument();
  });

  test("stacks tasks that share a time slot instead of overlapping them", async () => {
    const a = makeTask({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", scheduled: "2026-08-14", dueTime: "11:00", minutes: 60, title: "Overlap A" });
    const b = makeTask({ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", scheduled: "2026-08-14", dueTime: "11:00", minutes: 60, title: "Overlap B" });
    const view = renderWorkspace(<DashboardTimeline todayISO="2026-08-14" />, emptyWorkspace({ tasks: [a, b] }));

    await screen.findByRole("button", { name: "Overlap A" });
    fireEvent.change(screen.getByLabelText("Timeline range"), { target: { value: "0" } });

    const bars = view.container.querySelectorAll<HTMLElement>('[data-testid="timeline-bar"]');
    expect(bars).toHaveLength(2);
    // Same horizontal slot, different vertical slot.
    expect(bars[0].style.left).toBe(bars[1].style.left);
    expect(bars[0].style.top).not.toBe(bars[1].style.top);
  });

  test("packs untimed chips side by side rather than one per row", async () => {
    const a = makeTask({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", scheduled: "2026-08-14", title: "Chip A" });
    const b = makeTask({ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", scheduled: "2026-08-14", title: "Chip B" });
    renderWorkspace(<DashboardTimeline todayISO="2026-08-14" />, emptyWorkspace({ tasks: [a, b] }));

    await screen.findByRole("button", { name: "Chip A" });
    fireEvent.change(screen.getByLabelText("Timeline range"), { target: { value: "0" } });

    const strip = screen.getByLabelText("Unscheduled tasks for 2026-08-14");
    for (const chip of strip.querySelectorAll('[data-testid="timeline-bar"]')) {
      expect(chip).not.toHaveClass("w-full");
    }
  });

  test("shows tasks whose project is not loaded yet instead of dropping them", async () => {
    const task = makeTask({ scheduled: "2026-08-14", projectId: "99999999-9999-4999-8999-999999999999", title: "Orphaned work" });
    renderWorkspace(<DashboardTimeline todayISO="2026-08-14" />, emptyWorkspace({ tasks: [task] }));

    await screen.findByRole("button", { name: "Orphaned work" });
    fireEvent.change(screen.getByLabelText("Timeline range"), { target: { value: "3" } });
    expect(screen.getByTestId("day-scale-timeline")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Orphaned work" })).toBeInTheDocument();
  });

  test("uses day-scale project lanes at five days and opens task details", async () => {
    const project = makeProject({ color: "#db2777" });
    const task = makeTask({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", scheduled: "2026-08-14", projectId: project.id, title: "Ship timeline" });
    const view = renderWorkspace(
      <>
        <DashboardTimeline todayISO="2026-08-14" />
        <TaskPanel />
      </>,
      emptyWorkspace({ projects: [project], tasks: [task] }),
    );

    await screen.findByRole("button", { name: "Ship timeline" });
    fireEvent.change(screen.getByLabelText("Timeline range"), { target: { value: "3" } });
    expect(screen.getByTestId("day-scale-timeline")).toBeInTheDocument();
    expect(screen.getByText("Website")).toBeInTheDocument();

    await userEvent.click(await screen.findByRole("button", { name: "Ship timeline" }));
    expect(view.container.querySelector('[data-testid="timeline-bar"]')).toHaveStyle({ backgroundColor: "#db2777" });
    expect(await screen.findByRole("dialog", { name: "Task" })).toBeInTheDocument();
  });

  test("renders a complex task as one spanning bar, clipped at the visible window's edges", async () => {
    const project = makeProject({ color: "#16a34a" });
    const task = makeTask({
      scheduled: "2026-08-12",
      isComplex: true,
      finishDate: "2026-08-20",
      projectId: project.id,
      title: "Write the report",
    });
    const view = renderWorkspace(
      <DashboardTimeline todayISO="2026-08-14" />,
      emptyWorkspace({ projects: [project], tasks: [task] }),
    );

    await screen.findByRole("button", { name: "Write the report" });
    fireEvent.change(screen.getByLabelText("Timeline range"), { target: { value: "3" } });

    // Visible window is 2026-08-14..2026-08-18 (5 days); the range starts
    // 2026-08-12 (before the window) and ends 2026-08-20 (after it), so the
    // bar should be clamped to the full width, starting at the left edge.
    const bar = view.container.querySelector<HTMLElement>('[data-testid="timeline-bar"]');
    expect(bar).toHaveStyle({ left: "0%", width: "100%" });
  });

  test("mounts Today in a bounded workspace with its timeline", () => {
    const { container } = renderWorkspace(<Today />);

    const primaryPane = container.querySelector<HTMLElement>('[data-testid="today-primary-pane"]');
    const timeline = container.querySelector<HTMLElement>('[data-testid="today-timeline"]');

    expect(container.querySelector('[data-testid="today-workspace"]')).toBeInTheDocument();
    expect(primaryPane).toHaveAttribute("data-density", "compact");
    expect(primaryPane).toContainElement(timeline);
  });
});
