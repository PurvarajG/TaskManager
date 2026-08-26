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

  test("uses an accessible description-list structure with value as dd and label as dt", () => {
    const { container } = render(
      <MetricStrip
        items={[
          { value: "68%", label: "complete" },
          { value: "2", label: "need attention" },
        ]}
      />,
    );

    const dl = container.querySelector("dl");
    expect(dl).toBeInTheDocument();

    const dts = container.querySelectorAll("dt");
    const dds = container.querySelectorAll("dd");
    expect(dts).toHaveLength(2);
    expect(dds).toHaveLength(2);

    expect(dds[0]).toHaveTextContent("68%");
    expect(dts[0]).toHaveTextContent("complete");
    expect(dds[1]).toHaveTextContent("2");
    expect(dts[1]).toHaveTextContent("need attention");
  });

  test("renders nothing for an empty item list", () => {
    const { container } = render(<MetricStrip items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
