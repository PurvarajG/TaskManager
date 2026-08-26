import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import SectionLabel from "@/components/SectionLabel";

describe("SectionLabel", () => {
  test("plain variant (the default) renders label text with the .no-drag opt-out", () => {
    render(<SectionLabel>Tracking</SectionLabel>);

    const label = screen.getByText("Tracking");
    expect(label.closest(".no-drag")).not.toBeNull();
  });

  test("eyebrow variant renders the same label text with its own bordered pill, still .no-drag", () => {
    render(<SectionLabel variant="eyebrow">Project workspace</SectionLabel>);

    const label = screen.getByText("Project workspace");
    expect(label.closest(".no-drag")).not.toBeNull();
  });

  test("pulse renders the animated dot regardless of variant", () => {
    const { container } = render(
      <SectionLabel variant="eyebrow" pulse>
        Calendar
      </SectionLabel>,
    );

    expect(container.querySelector(".animate-pulse-dot")).not.toBeNull();
  });
});
