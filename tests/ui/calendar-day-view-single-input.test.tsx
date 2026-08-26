import { screen, waitFor } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import CalendarPage from "@/app/calendar/page";
import { emptyWorkspace, makeProject, makeTask, renderWorkspace } from "./harness";

const DATE = "2026-03-10";

// The calendar page reads `?view=` and `?date=` itself (see app/calendar/page.tsx),
// so the deep link that Today's timeline uses — and the one DayGrid's own
// "Add a task on this day" button drove before this fix — is reproduced here
// via a mocked useSearchParams rather than a real router.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams({ view: "day", date: DATE }),
}));

vi.mock("@/lib/useNow", () => ({
  useNow: () => new Date(`${DATE}T09:00:00.000Z`),
}));

const task = makeTask({ scheduled: DATE, title: "Ship the board" });
const project = makeProject();

describe("calendar day view", () => {
  test("landing on ?view=day&date= via the deep link mounts exactly one add-task input", async () => {
    renderWorkspace(
      <CalendarPage />,
      emptyWorkspace({ tasks: [task], projects: [project] }),
    );

    // The rail's DayPanelBody renders once the day's data is in; the old
    // DayPanel modal, which used to also open for this same day, must not
    // mount a second copy behind it.
    await waitFor(() => {
      expect(screen.getAllByPlaceholderText("What needs doing?")).toHaveLength(1);
    });

    // DayGrid's "Add a task on this day" button must still reach a usable,
    // focusable input in day view rather than opening a redundant modal.
    const trigger = screen.getByRole("button", { name: "Add a task on this day" });
    trigger.click();
    const input = screen.getByPlaceholderText("What needs doing?");
    expect(input).toHaveFocus();
  });
});
