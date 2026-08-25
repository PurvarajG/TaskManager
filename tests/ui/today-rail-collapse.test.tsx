import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import Today from "@/components/Today";
import { emptyWorkspace, makeTask, renderWorkspace } from "./harness";

vi.mock("@/lib/useNow", () => ({
  useNow: () => new Date("2026-08-14T12:00:00"),
}));

describe("Today's collapsible right rail", () => {
  test("Due today starts as a full ModuleCard-style panel and collapses through patchSettings, reusing Tracking's collapsedModules mechanism", async () => {
    const task = makeTask({ scheduled: "2026-08-14", title: "Ship the report" });
    const { mock } = renderWorkspace(<Today />, emptyWorkspace({ tasks: [task] }));

    const collapseButton = await screen.findByRole("button", { name: "Collapse Due today · 1" });
    const panel = collapseButton.closest("section")!;
    expect(within(panel).getByText("Ship the report")).toBeInTheDocument();

    fireEvent.click(collapseButton);

    // patchSettings persists the collapse the same way Tracking does, via
    // the shared collapsedModules array on tracking_settings.
    expect(mock.calls.at(-1)).toMatchObject({
      url: "/api/tracking-settings",
      method: "PATCH",
      body: { collapsedModules: ["today-due"] },
    });

    // The optimistic update applies immediately, before the request resolves.
    expect(screen.getByRole("button", { name: "Expand Due today · 1" })).toBeInTheDocument();
    expect(within(panel).queryByText("Ship the report")).not.toBeInTheDocument();
  });

  test("an empty rail panel renders a single quiet line, not a full card", async () => {
    renderWorkspace(<Today />, emptyWorkspace({ tasks: [] }));

    // Nothing due today: no disclosure card, no collapse control — just the label
    // and the empty-state text on one line.
    await screen.findByText("Due today");
    expect(screen.getByText("Nothing is scheduled for today.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Collapse Due today · 1" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Expand Due today · 1" })).not.toBeInTheDocument();
  });

  test("a previously-collapsed panel (from settings) renders collapsed on load", async () => {
    const task = makeTask({ scheduled: "2026-08-14", title: "Ship the report" });
    renderWorkspace(
      <Today />,
      emptyWorkspace({
        tasks: [task],
        trackingSettings: {
          dayStartHour: 4,
          wakingStartHour: 7,
          wakingEndHour: 23,
          minGapMinutes: 10,
          moduleOrder: [],
          hiddenModules: [],
          collapsedModules: ["today-due"],
          hiddenNavItems: [],
          updatedAt: "2026-03-01T09:00:00.000Z",
        },
      }),
    );

    const expandButton = await screen.findByRole("button", { name: "Expand Due today · 1" });
    const panel = expandButton.closest("section")!;
    expect(within(panel).queryByText("Ship the report")).not.toBeInTheDocument();
  });
});
