import { screen } from "@testing-library/react";
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
    expect(screen.getByRole("link", { name: "Trash" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings" })).toBeInTheDocument();
  });

  it("hides an entry on the nav once it's in hiddenNavItems", async () => {
    renderWorkspace(<Sidebar />, withHiddenNavItems(["trash"]));

    await screen.findByRole("link", { name: "Next 7 Days" });
    expect(screen.queryByRole("link", { name: "Trash" })).toBeNull();
    expect(screen.getByRole("link", { name: "Settings" })).toBeInTheDocument();
  });
});
