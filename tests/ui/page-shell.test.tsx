import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import PageShell from "@/components/ui/PageShell";

describe("PageShell", () => {
  test("renders label, title, and actions", () => {
    render(
      <PageShell label="Tracking" title="Today" actions={<button>Settings</button>}>
        <p>Body</p>
      </PageShell>,
    );

    expect(screen.getByText("Tracking")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Today" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByText("Body")).toBeInTheDocument();
  });

  test("wraps header actions in .no-drag, so they never fall into the titlebar drag band", () => {
    render(
      <PageShell label="Calendar" title="August" actions={<button>Month</button>}>
        <p>Body</p>
      </PageShell>,
    );

    const action = screen.getByRole("button", { name: "Month" });
    expect(action.closest(".no-drag")).not.toBeNull();
  });

  test("without a rail, renders children in a single scrolling column", () => {
    const railClasses = [
      "rail:grid-cols-[minmax(28rem,1fr)_var(--width-rail)]",
      "rail:grid-rows-[minmax(0,1fr)]",
      "rail:gap-x-6",
      "rail:overflow-hidden",
    ];
    const { container, rerender } = render(
      <PageShell label="Search" title="Results">
        <p>Result row</p>
      </PageShell>,
    );

    expect(container.querySelector('[data-testid="page-shell-workspace"]')).toBeNull();
    expect(screen.getByText("Result row")).toBeInTheDocument();

    const workspaceWithoutRail = screen.getByText("Result row").parentElement?.parentElement;
    expect(workspaceWithoutRail).not.toBeNull();
    for (const cls of railClasses) {
      expect(workspaceWithoutRail?.className).not.toContain(cls);
    }

    // Falsification control: prove the assertions above target the actual
    // workspace classes by rendering the same shell with a rail and requiring
    // every guarded token to become observable.
    rerender(
      <PageShell label="Search" title="Results" rail={<div>Rail content</div>}>
        <p>Result row</p>
      </PageShell>,
    );
    const workspaceWithRail = screen.getByTestId("page-shell-workspace");
    for (const cls of railClasses) {
      expect(workspaceWithRail.className).toContain(cls);
    }
  });

  test("with a rail, splits into a two-column workspace grid and honours a custom testid", () => {
    render(
      <PageShell
        label="Today"
        title="Today"
        rail={<div>Rail content</div>}
        workspaceTestId="today-workspace"
      >
        <p>Primary content</p>
      </PageShell>,
    );

    expect(screen.getByTestId("today-workspace")).toBeInTheDocument();
    expect(screen.getByText("Rail content")).toBeInTheDocument();
    expect(screen.getByText("Primary content")).toBeInTheDocument();
  });

  test("the root frame carries the shell: variant classes, not the stock lg: breakpoint", () => {
    const { container } = render(
      <PageShell label="Today" title="Today">
        <p>Body</p>
      </PageShell>,
    );

    const root = container.firstElementChild as HTMLElement;
    // These are the specific classes that silently compiled to nothing when
    // `@custom-variant shell (min-width: 900px)` (missing the `@media`
    // at-rule form) was used — this jsdom check only proves PageShell still
    // EMITS the right className tokens; whether the `shell:`/`rail:`
    // variants actually compile to real CSS is covered separately in
    // tests/shell-variant-compiles.test.ts, since jsdom doesn't run a CSS
    // engine and can't see that failure mode at all.
    for (const cls of ["shell:flex", "shell:h-dvh", "shell:flex-col", "shell:overflow-hidden"]) {
      expect(root.className).toContain(cls);
    }
    // The frame must not have regressed back onto Tailwind's stock `lg:`
    // (1024px) breakpoint, which is narrower than what the Electron window
    // can actually reach down to (900px).
    expect(root.className).not.toMatch(/(?:^|\s)lg:(?:flex|h-dvh|flex-col|overflow-hidden)(?:\s|$)/);
  });

  test("the rail grid engages at rail:, with a floored primary column and the shared rail-width token", () => {
    const { container } = render(
      <PageShell label="Tracking" title="Tracking" rail={<div>Rail content</div>}>
        <p>Body</p>
      </PageShell>,
    );

    const workspace = container.querySelector('[data-testid="page-shell-workspace"]') as HTMLElement;
    expect(workspace.className).toContain("rail:grid-cols-[minmax(28rem,1fr)_var(--width-rail)]");
    // A hard floor on the primary column is the fix for it being squeezed
    // narrower than the rail — this must never silently drop back to an
    // unfloored `minmax(0,1fr)`.
    expect(workspace.className).not.toContain("minmax(0,1fr)_var(--width-rail)");
  });

  test("each pane scrolls independently at rail:, and nothing defeats that wiring", () => {
    const { container } = render(
      <PageShell label="Today" title="Today" rail={<div>Rail content</div>}>
        <p>Primary content</p>
      </PageShell>,
    );

    const workspace = container.querySelector('[data-testid="page-shell-workspace"]') as HTMLElement;
    const mainPane = workspace.children[0] as HTMLElement;
    const railPane = workspace.children[1] as HTMLElement;

    // Regression test for a real incident: an `items-start` override on the
    // rail: grid replaced its default `stretch` alignment, so each pane's box resolved to
    // its own CONTENT height instead of the grid row's height. A box sized
    // to its content can never overflow, which made `rail:overflow-y-auto`
    // on both panes permanently inert — nothing actually scrolled except
    // the outer workspace (still carrying `shell:overflow-y-auto` at every
    // width, since it wasn't switched off at `rail:`), so scrolling the
    // rail dragged the whole page — including the primary column — up
    // with it, instead of the two panes holding position independently.
    for (const pane of [mainPane, railPane]) {
      expect(pane.className).toContain("rail:min-h-0");
      expect(pane.className).toContain("rail:overflow-y-auto");
    }

    // The grid itself must keep the default `stretch` alignment — no
    // `items-start`/`items-center`/`items-end` override at `rail:`, which
    // would resolve each pane to content height and silently defeat the
    // overflow rules above even though they're still present in the class
    // list.
    expect(workspace.className).not.toMatch(/rail:items-(?:start|center|end)/);

    // The outer workspace's own scroll (used below `rail:`, where the rail
    // stacks under the main column in one shared region) must be switched
    // OFF once the independent per-pane scrolling takes over at `rail:` —
    // otherwise the outer scroller and the two inner ones nest, and the
    // outer one — sized to fit exactly, so inert in practice, but still
    // wired — would be the thing that actually moves, dragging both panes
    // together instead of them holding position on their own.
    expect(workspace.className).toContain("shell:overflow-y-auto");
    expect(workspace.className).toContain("rail:overflow-hidden");
  });
});
