import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import Board from "@/components/kanban/Board";
import ErrorToast from "@/components/ErrorToast";
import { emptyWorkspace, makeProject, makeStages, makeTask, renderWorkspace } from "./harness";

const project = makeProject();
const stages = makeStages(project.id);

function board(tasks = [makeTask({ projectId: project.id, stageId: stages[0].id })]) {
  return {
    tasks,
    workspace: emptyWorkspace({ tasks, projects: [project], stages }),
  };
}

function Surface() {
  return (
    <>
      <Board project={project} todayISO="2026-03-01" />
      <ErrorToast />
    </>
  );
}

describe("project kanban board", () => {
  test("renders every column with its task count", async () => {
    const { workspace } = board();
    renderWorkspace(<Surface />, workspace);

    expect(await screen.findByRole("region", { name: "Backlog, 1 task" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "In Progress, 0 tasks" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Done, 0 tasks" })).toBeInTheDocument();
  });

  test("a card moves between columns from the keyboard, and the move is announced", async () => {
    const { tasks, workspace } = board();
    const { mock } = renderWorkspace(<Surface />, workspace);

    await userEvent.click(
      await screen.findByRole("button", { name: "Move Write the plan to another column" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Move to In Progress" }));

    await waitFor(() => {
      expect(mock.calls).toContainEqual({
        url: `/api/tasks/${tasks[0].id}/move`,
        method: "POST",
        body: { stageId: stages[1].id, index: 0 },
      });
    });
    expect(screen.getByText("Write the plan moved to In Progress.")).toBeInTheDocument();
  });

  test("a failed move puts the card back and shows why", async () => {
    const { workspace } = board();
    const { mock } = renderWorkspace(<Surface />, workspace);
    mock.failNext("/move", 400, "That column belongs to a different project");

    await userEvent.click(
      await screen.findByRole("button", { name: "Move Write the plan to another column" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Move to Blocked" }));

    expect(
      await screen.findByText("That column belongs to a different project"),
    ).toBeInTheDocument();
    // Rolled back: the card is in Backlog again, and Blocked is empty.
    await waitFor(() =>
      expect(screen.getByRole("region", { name: "Backlog, 1 task" })).toBeInTheDocument(),
    );
    expect(screen.getByRole("region", { name: "Blocked, 0 tasks" })).toBeInTheDocument();
  });

  test("removing a column with tasks requires choosing a destination first", async () => {
    const { workspace } = board();
    renderWorkspace(<Surface />, workspace);

    await userEvent.click(await screen.findByRole("button", { name: "Remove Backlog column" }));

    const dialog = await screen.findByRole("dialog", { name: "Remove the Backlog column" });
    expect(within(dialog).getByText("1 task needs a new column first.")).toBeInTheDocument();

    const remove = within(dialog).getByRole("button", { name: "Remove column" });
    expect(remove).toBeDisabled();

    await userEvent.selectOptions(within(dialog).getByLabelText("Move tasks to"), stages[1].id);
    expect(remove).toBeEnabled();
  });

  test("an empty column can be removed without choosing a destination", async () => {
    const { workspace } = board();
    renderWorkspace(<Surface />, workspace);

    await userEvent.click(await screen.findByRole("button", { name: "Remove Blocked column" }));

    const dialog = await screen.findByRole("dialog", { name: "Remove the Blocked column" });
    expect(within(dialog).getByText("This column is empty.")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Remove column" })).toBeEnabled();
    expect(within(dialog).queryByLabelText("Move tasks to")).not.toBeInTheDocument();
  });

  test("renaming a column saves on blur", async () => {
    const { workspace } = board();
    const { mock } = renderWorkspace(<Surface />, workspace);

    const input = await screen.findByRole("textbox", { name: "Rename Backlog column" });
    await userEvent.clear(input);
    await userEvent.type(input, "Icebox");
    await userEvent.tab();

    await waitFor(() => {
      expect(mock.calls).toContainEqual({
        url: `/api/stages/${stages[0].id}`,
        method: "PATCH",
        body: { name: "Icebox" },
      });
    });
  });

  test("a new column can't be created as a second done column", async () => {
    const { workspace } = board();
    renderWorkspace(<Surface />, workspace);

    await userEvent.click(await screen.findByRole("button", { name: "+ Add column" }));

    const kinds = within(screen.getByLabelText("Behaves as"))
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(kinds).toEqual(["backlog", "active", "blocked"]);
  });

  test("cards state overdue in words, not only in colour", async () => {
    const { workspace } = board([
      makeTask({ projectId: project.id, stageId: stages[0].id, scheduled: "2026-02-20" }),
    ]);
    renderWorkspace(<Surface />, workspace);

    expect(await screen.findByText(/Overdue/)).toBeInTheDocument();
  });

  test("a complex task shows its full range instead of a single date", async () => {
    const { workspace } = board([
      makeTask({
        projectId: project.id,
        stageId: stages[0].id,
        isComplex: true,
        scheduled: "2026-03-01",
        finishDate: "2026-03-05",
      }),
    ]);
    renderWorkspace(<Surface />, workspace);

    expect(await screen.findByText(/Mar 1.*→.*Mar 5/)).toBeInTheDocument();
  });

  test("a complex task is overdue only once its finish date passes", async () => {
    const { workspace } = board([
      makeTask({
        projectId: project.id,
        stageId: stages[0].id,
        isComplex: true,
        scheduled: "2026-02-25",
        finishDate: "2026-03-05",
      }),
    ]);
    renderWorkspace(<Surface />, workspace);

    // todayISO is 2026-03-01: the range's start has passed but its finish
    // hasn't, so this open-started task isn't overdue.
    expect(await screen.findByText(/Feb 25.*→.*Mar 5/)).toBeInTheDocument();
    expect(screen.queryByText(/Overdue/)).not.toBeInTheDocument();
  });
});
