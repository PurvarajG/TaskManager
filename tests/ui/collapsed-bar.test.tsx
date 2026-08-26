import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import CollapsedBar from "@/components/ui/CollapsedBar";

describe("CollapsedBar", () => {
  test("renders the label and count", () => {
    render(<CollapsedBar label="Backlog" count={12} onExpand={() => {}} />);

    expect(screen.getByText("Backlog")).toBeInTheDocument();
    expect(screen.getByText("· 12")).toBeInTheDocument();
    expect(screen.getByText("Expand")).toBeInTheDocument();
  });

  test("calls onExpand when clicked", () => {
    const onExpand = vi.fn();
    render(<CollapsedBar label="Backlog" count={3} onExpand={onExpand} />);

    fireEvent.click(screen.getByRole("button"));
    expect(onExpand).toHaveBeenCalledOnce();
  });

  test("supports a custom expand label", () => {
    render(
      <CollapsedBar label="Done" count={5} onExpand={() => {}} expandLabel="Show" />,
    );

    expect(screen.getByText("Show")).toBeInTheDocument();
    expect(screen.queryByText("Expand")).not.toBeInTheDocument();
  });
});
