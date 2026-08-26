import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import Panel from "@/components/ui/Panel";

describe("Panel", () => {
  test("renders title and content when not collapsed", () => {
    render(
      <Panel title="Signals">
        <p>Signal list</p>
      </Panel>,
    );

    expect(screen.getByText("Signals")).toBeInTheDocument();
    expect(screen.getByText("Signal list")).toBeInTheDocument();
  });

  test("uncontrolled collapse toggles locally", () => {
    render(
      <Panel title="Signals">
        <p>Signal list</p>
      </Panel>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Collapse Signals" }));
    expect(screen.queryByText("Signal list")).not.toBeInTheDocument();
  });

  test("controlled collapse calls onToggleCollapse and respects the collapsed prop", () => {
    const onToggleCollapse = vi.fn();
    render(
      <Panel title="Signals" collapsed={false} onToggleCollapse={onToggleCollapse}>
        <p>Signal list</p>
      </Panel>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Collapse Signals" }));
    expect(onToggleCollapse).toHaveBeenCalledOnce();
    // Controlled: content still shown because the `collapsed` prop hasn't changed.
    expect(screen.getByText("Signal list")).toBeInTheDocument();
  });

  test("empty renders the quiet dashed line instead of the card", () => {
    render(
      <Panel title="Due today" empty emptyText="Nothing scheduled.">
        <p>Should not render</p>
      </Panel>,
    );

    expect(screen.getByText("Due today")).toBeInTheDocument();
    expect(screen.getByText("Nothing scheduled.")).toBeInTheDocument();
    expect(screen.queryByText("Should not render")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  test("collapsible=false hides the toggle button", () => {
    render(
      <Panel title="Signals" collapsible={false}>
        <p>Signal list</p>
      </Panel>,
    );

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
