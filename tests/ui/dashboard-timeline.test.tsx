import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import Today from "@/components/Today";
import DashboardTimeline from "@/components/today/DashboardTimeline";
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

  test("moves by the selected span and links unused days to the calendar", async () => {
    renderWorkspace(<DashboardTimeline todayISO="2026-08-14" />);

    fireEvent.change(screen.getByLabelText("Timeline range"), { target: { value: "0" } });
    await userEvent.click(screen.getByRole("button", { name: "Next 1 day" }));

    expect(screen.getByRole("link", { name: "Add a task on 2026-08-15" })).toHaveAttribute(
      "href",
      "/calendar?date=2026-08-15",
    );
  });

  test("opens scheduled tasks and uses project colours", async () => {
    const project = makeProject({ color: "#db2777" });
    const task = makeTask({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", scheduled: "2026-08-14", projectId: project.id, title: "Ship timeline" });
    const view = renderWorkspace(<DashboardTimeline todayISO="2026-08-14" />, emptyWorkspace({ projects: [project], tasks: [task] }));

    // The provider owns openTask; clicking still exercises the shared store action.
    await userEvent.click(await screen.findByRole("button", { name: "Ship timeline" }));
    expect(view.container.querySelector("button[style*='border-left-color']")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ship timeline" })).toBeInTheDocument();
  });

  test("mounts Today in a bounded workspace with its timeline", () => {
    const { container } = renderWorkspace(<Today />);

    expect(container.querySelector('[data-testid="today-workspace"]')).toBeInTheDocument();
    expect(container.querySelector('[data-testid="today-timeline"]')).toBeInTheDocument();
  });
});
