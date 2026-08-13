import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import TaskPanel from "@/components/TaskPanel";
import TaskRow from "@/components/TaskRow";
import ErrorToast from "@/components/ErrorToast";
import { emptyWorkspace, makeProject, makeStages, makeTask, renderWorkspace } from "./harness";

function surface() {
  const project = makeProject();
  const stages = makeStages(project.id);
  const task = makeTask({ projectId: project.id, stageId: stages[0].id });

  return {
    project,
    stages,
    task,
    workspace: emptyWorkspace({ tasks: [task], projects: [project], stages }),
  };
}

/** A list row, the panel, and the toast — the pairing AppChrome mounts. */
function Surface({ task }: { task: ReturnType<typeof makeTask> }) {
  return (
    <ul>
      <TaskRow task={task} todayISO="2026-03-01" />
      <TaskPanel />
      <ErrorToast />
    </ul>
  );
}

describe("shared task detail panel", () => {
  test("opens from a task row and shows the task's current values", async () => {
    const { task, workspace } = surface();
    renderWorkspace(<Surface task={task} />, workspace);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await userEvent.click(await screen.findByRole("button", { name: "Write the plan" }));

    const dialog = await screen.findByRole("dialog", { name: "Task" });
    expect(within(dialog).getByLabelText("Title")).toHaveValue("Write the plan");
    expect(within(dialog).getByLabelText("Project")).toHaveValue(workspace.projects[0].id);
    expect(within(dialog).getByLabelText("Column")).toHaveValue(workspace.stages[0].id);
  });

  test("saves an edited title on blur", async () => {
    const { task, workspace } = surface();
    const { mock } = renderWorkspace(<Surface task={task} />, workspace);

    await userEvent.click(await screen.findByRole("button", { name: "Write the plan" }));
    const title = await screen.findByLabelText("Title");

    await userEvent.clear(title);
    await userEvent.type(title, "Write the better plan");
    expect(mock.calls).toHaveLength(0);

    await userEvent.tab();
    await waitFor(() => {
      expect(mock.calls).toContainEqual({
        url: `/api/tasks/${task.id}`,
        method: "PATCH",
        body: { title: "Write the better plan" },
      });
    });
  });

  test("a failed edit rolls back and surfaces the server's message", async () => {
    const { task, workspace } = surface();
    const { mock } = renderWorkspace(<Surface task={task} />, workspace);

    await userEvent.click(await screen.findByRole("button", { name: "Write the plan" }));
    mock.failNext(`/api/tasks/${task.id}`, 400, "A task needs a title");

    const notes = await screen.findByLabelText("Notes");
    await userEvent.type(notes, "Some notes");
    await userEvent.tab();

    expect(await screen.findByText("A task needs a title")).toBeInTheDocument();
    // The row still shows the pre-edit task, because the patch was reverted.
    await waitFor(() => expect(screen.getByLabelText("Notes")).toHaveValue(""));
  });

  test("changing project clears the column when the project is removed", async () => {
    const { task, workspace } = surface();
    const { mock } = renderWorkspace(<Surface task={task} />, workspace);

    await userEvent.click(await screen.findByRole("button", { name: "Write the plan" }));
    await userEvent.selectOptions(await screen.findByLabelText("Project"), "");

    await waitFor(() => {
      expect(mock.calls).toContainEqual({
        url: `/api/tasks/${task.id}`,
        method: "PATCH",
        body: { projectId: "" },
      });
    });
    expect(await screen.findByLabelText("Column")).toBeDisabled();
  });

  test("Escape closes the panel and focus returns to the row that opened it", async () => {
    const { task, workspace } = surface();
    renderWorkspace(<Surface task={task} />, workspace);

    const trigger = await screen.findByRole("button", { name: "Write the plan" });
    await userEvent.click(trigger);
    await screen.findByRole("dialog", { name: "Task" });

    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  test("Tab is trapped inside the open panel", async () => {
    const { task, workspace } = surface();
    renderWorkspace(<Surface task={task} />, workspace);

    await userEvent.click(await screen.findByRole("button", { name: "Write the plan" }));
    const dialog = await screen.findByRole("dialog", { name: "Task" });

    for (let i = 0; i < 30; i++) await userEvent.tab();
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
  });
});
