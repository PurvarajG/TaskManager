import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import RailPanel from "@/components/ui/RailPanel";

describe("RailPanel", () => {
  test("renders its content when not collapsed", () => {
    render(
      <RailPanel title="Due today" collapsed={false} onToggleCollapse={() => {}}>
        <p>Task list</p>
      </RailPanel>,
    );

    expect(screen.getByText("Due today")).toBeInTheDocument();
    expect(screen.getByText("Task list")).toBeInTheDocument();
  });

  test("hides its content and calls onToggleCollapse when the disclosure header is clicked", () => {
    const onToggleCollapse = vi.fn();
    render(
      <RailPanel title="Blocked" collapsed={false} onToggleCollapse={onToggleCollapse}>
        <p>Blocked list</p>
      </RailPanel>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Collapse Blocked" }));
    expect(onToggleCollapse).toHaveBeenCalledOnce();
  });

  test("collapsed=true renders the disclosure header without the body", () => {
    render(
      <RailPanel title="Blocked" collapsed onToggleCollapse={() => {}}>
        <p>Blocked list</p>
      </RailPanel>,
    );

    expect(screen.getByText("Blocked")).toBeInTheDocument();
    expect(screen.queryByText("Blocked list")).not.toBeInTheDocument();
  });

  test("an empty panel renders a single quiet line instead of a full card", () => {
    render(
      <RailPanel
        title="Due today"
        collapsed={false}
        onToggleCollapse={() => {}}
        empty
        emptyText="Nothing is scheduled for today."
      >
        <p>This should not render</p>
      </RailPanel>,
    );

    expect(screen.getByText("Due today")).toBeInTheDocument();
    expect(screen.getByText("Nothing is scheduled for today.")).toBeInTheDocument();
    expect(screen.queryByText("This should not render")).not.toBeInTheDocument();
    // No collapse toggle on the quiet empty-state line — there's nothing to disclose.
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
