import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import MetricStrip from "@/components/ui/MetricStrip";

describe("MetricStrip", () => {
  test("renders each item's value and label", () => {
    render(
      <MetricStrip
        items={[
          { value: "68%", label: "complete" },
          { value: "2", label: "need attention" },
        ]}
      />,
    );

    expect(screen.getByText("68%")).toBeInTheDocument();
    expect(screen.getByText("complete")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("need attention")).toBeInTheDocument();
  });

  test("renders nothing for an empty item list", () => {
    const { container } = render(<MetricStrip items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
