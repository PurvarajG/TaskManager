import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Sidebar from "@/components/Sidebar";
import { emptyWorkspace, renderWorkspace } from "./harness";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn() }),
}));

/** jsdom in this Node version doesn't wire up localStorage on its own; ThemeToggle needs it. */
beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
  });
});

function withHiddenNavItems(hiddenNavItems: string[]) {
  return emptyWorkspace({
    trackingSettings: {
      dayStartHour: 4,
      wakingStartHour: 7,
      wakingEndHour: 23,
      minGapMinutes: 10,
      moduleOrder: [],
      hiddenModules: [],
      collapsedModules: [],
      hiddenNavItems,
      updatedAt: "2026-03-01T09:00:00.000Z",
    },
  });
}

describe("sidebar nav visibility", () => {
  it("shows the full nav before settings has loaded, to avoid flashing an empty sidebar", () => {
    renderWorkspace(<Sidebar />);
    // Right after render, the tracking-settings fetch hasn't resolved yet —
    // the sidebar must still show every entry, Trash included.
    expect(screen.getAllByRole("link", { name: "Trash" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "Settings" }).length).toBeGreaterThan(0);
  });

  it("hides an entry on the desktop nav once it's in hiddenNavItems", async () => {
    renderWorkspace(<Sidebar />, withHiddenNavItems(["trash"]));

    await screen.findByRole("link", { name: "Next 7 Days" });
    expect(screen.queryByRole("link", { name: "Trash" })).toBeNull();
    expect(screen.getByRole("link", { name: "Settings" })).toBeInTheDocument();
  });

  it("hides the same entry in the mobile slide-over, and it survives opening it", async () => {
    renderWorkspace(<Sidebar />, withHiddenNavItems(["trash"]));

    await screen.findByRole("link", { name: "Next 7 Days" });
    fireEvent.click(screen.getByLabelText("Open menu"));
    await screen.findByLabelText("Close menu");

    // The slide-over renders its own NavLinks, so once open there are two
    // "Next 7 Days" links (desktop + mobile) but Trash stays hidden in both.
    expect(screen.getAllByRole("link", { name: "Next 7 Days" }).length).toBe(2);
    expect(screen.queryByRole("link", { name: "Trash" })).toBeNull();
  });
});
