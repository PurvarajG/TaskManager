import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import GeneralNote from "@/components/today/GeneralNote";
import QuickTodos from "@/components/today/QuickTodos";
import TaskPanel from "@/components/TaskPanel";
import ErrorToast from "@/components/ErrorToast";
import { emptyWorkspace, makeTask, renderWorkspace } from "./harness";

const todo = {
  id: "44444444-4444-4444-8444-444444444444",
  title: "Call the bank",
  done: false,
  sortOrder: 0,
  createdAt: "2026-03-01T09:00:00.000Z",
  updatedAt: "2026-03-01T09:00:00.000Z",
};

describe("general notepad", () => {
  beforeEach(() => vi.useRealTimers());

  test("loads the saved note and autosaves after a pause", async () => {
    const { mock } = renderWorkspace(
      <GeneralNote />,
      emptyWorkspace({ note: { body: "Existing", updatedAt: "2026-03-01T09:00:00.000Z" } }),
    );

    const box = await screen.findByLabelText("General notepad");
    await waitFor(() => expect(box).toHaveValue("Existing"));

    await userEvent.type(box, "!");
    // Debounced: the keystroke alone must not have saved anything yet.
    expect(mock.calls).toHaveLength(0);
    expect(await screen.findByText("Saving…")).toBeInTheDocument();

    await waitFor(
      () =>
        expect(mock.calls).toContainEqual({
          url: "/api/note",
          method: "PUT",
          body: { body: "Existing!" },
        }),
      { timeout: 2000 },
    );
    expect(await screen.findByText("Saved")).toBeInTheDocument();
  });

  test("a failed save keeps the text and offers a retry that sends it again", async () => {
    const { mock } = renderWorkspace(<GeneralNote />, emptyWorkspace());

    const box = await screen.findByLabelText("General notepad");
    mock.failNext("/api/note", 500, "Something went wrong");
    await userEvent.type(box, "Do not lose me");

    expect(await screen.findByText("Couldn't save")).toBeInTheDocument();
    // The unsaved text is still on screen — a failed save loses nothing.
    expect(box).toHaveValue("Do not lose me");

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() =>
      expect(mock.calls.filter((c) => c.url === "/api/note").length).toBeGreaterThan(1),
    );
    expect(await screen.findByText("Saved")).toBeInTheDocument();
  });
});

describe("quick to-do checklist", () => {
  test("adds, renames, and completes items", async () => {
    const { mock } = renderWorkspace(<QuickTodos />, emptyWorkspace({ quickTodos: [todo] }));

    await userEvent.click(
      await screen.findByRole("button", { name: "Complete Call the bank" }),
    );
    await waitFor(() =>
      expect(mock.calls).toContainEqual({
        url: `/api/quick-todos/${todo.id}`,
        method: "PATCH",
        body: { done: true },
      }),
    );

    const field = screen.getByLabelText("Add to quick list");
    await userEvent.type(field, "Water the plants{Enter}");
    await waitFor(() =>
      expect(mock.calls).toContainEqual({
        url: "/api/quick-todos",
        method: "POST",
        body: { title: "Water the plants" },
      }),
    );
  });

  test("converting opens the new task in the shared panel and drops the item", async () => {
    const created = makeTask({ title: "Call the bank" });
    const { mock } = renderWorkspace(
      <>
        <QuickTodos />
        <TaskPanel />
      </>,
      emptyWorkspace({ quickTodos: [todo] }),
    );
    mock.respondWith("/convert", created);

    await userEvent.click(await screen.findByRole("button", { name: "→ Task" }));

    // The item only disappears once the task really exists.
    await waitFor(() =>
      expect(screen.queryByLabelText("Rename Call the bank")).not.toBeInTheDocument(),
    );
    expect(await screen.findByRole("dialog", { name: "Task" })).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toHaveValue("Call the bank");
  });

  test("a failed conversion keeps the item on the list", async () => {
    const { mock } = renderWorkspace(
      <>
        <QuickTodos />
        <ErrorToast />
      </>,
      emptyWorkspace({ quickTodos: [todo] }),
    );
    mock.failNext("/convert", 500, "Something went wrong");

    await userEvent.click(await screen.findByRole("button", { name: "→ Task" }));

    expect(await screen.findByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByLabelText("Rename Call the bank")).toBeInTheDocument();
  });
});
