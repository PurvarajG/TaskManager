import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi, afterEach } from "vitest";
import CategoryPicker from "@/components/tracking/CategoryPicker";
import TaskPicker from "@/components/tracking/TaskPicker";
import SidePanel from "@/components/ui/SidePanel";
import { makeCategory, makeTask } from "./harness";

const categories = [
  makeCategory({ id: "cat-1", name: "Focus Work" }),
  makeCategory({ id: "cat-2", name: "Admin" }),
  makeCategory({ id: "cat-3", name: "Rest" }),
];

const tasks = [
  makeTask({ id: "task-1", title: "Write the plan", scheduled: "2026-03-01" }),
  makeTask({ id: "task-2", title: "Write the tests", scheduled: "2026-03-01" }),
  makeTask({ id: "task-3", title: "Review the PR", scheduled: "2026-02-28" }),
];

const emptyRect: DOMRect = {
  top: 0,
  bottom: 0,
  left: 0,
  right: 0,
  width: 0,
  height: 0,
  x: 0,
  y: 0,
  toJSON: () => {},
};

/**
 * Stub `getBoundingClientRect` for the trigger button (role="combobox" on a
 * <button>) and the portalled menu root (`[data-picker-menu]`) independently
 * and mutably, so tests can move either box mid-test (e.g. scroll the
 * trigger out of view) and drive the hook's real measurement-based
 * placement/clamping logic instead of a hardcoded constant.
 */
function stubRects({
  trigger,
  menu,
}: {
  trigger: () => Partial<DOMRect>;
  menu: () => Partial<DOMRect>;
}) {
  Element.prototype.getBoundingClientRect = vi.fn(function (this: Element) {
    if (this.tagName === "BUTTON" && this.getAttribute("role") === "combobox") {
      return { ...emptyRect, ...trigger() };
    }
    if (this.hasAttribute("data-picker-menu")) {
      return { ...emptyRect, ...menu() };
    }
    return { ...emptyRect };
  }) as unknown as typeof Element.prototype.getBoundingClientRect;
}

/** Fixed trigger near the top-left, and a modest 120px-tall menu — the
 *  common case where geometry doesn't matter to the assertion. */
function stubDefaultRects() {
  stubRects({
    trigger: () => ({ top: 100, bottom: 132, left: 20, right: 100, width: 80, height: 32 }),
    menu: () => ({ height: 120, width: 192 }),
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CategoryPicker portal menu", () => {
  test("renders the menu outside the trigger's own DOM subtree (portal)", async () => {
    stubDefaultRects();
    const user = userEvent.setup();
    const onChange = vi.fn();

    const { container } = render(
      <div data-testid="card-subtree">
        <CategoryPicker categories={categories} value={undefined} onChange={onChange} />
      </div>,
    );

    await user.click(screen.getByRole("combobox", { name: "Category" }));

    const menu = await screen.findByRole("listbox");
    const subtree = within(container).getByTestId("card-subtree");
    expect(subtree.contains(menu)).toBe(false);
    expect(document.body.contains(menu)).toBe(true);
  });

  test("Escape closes the menu and returns focus to the trigger", async () => {
    stubDefaultRects();
    const user = userEvent.setup();

    render(<CategoryPicker categories={categories} value={undefined} onChange={vi.fn()} />);

    const trigger = screen.getByRole("combobox", { name: "Category" });
    await user.click(trigger);
    expect(await screen.findByRole("listbox")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  test("Escape inside a SidePanel dismisses only the picker, not the panel underneath it", async () => {
    stubDefaultRects();
    const user = userEvent.setup();
    const onPanelClose = vi.fn();

    render(
      <SidePanel open onClose={onPanelClose} title="Project settings">
        <CategoryPicker categories={categories} value={undefined} onChange={vi.fn()} label="Timer category" />
      </SidePanel>,
    );

    const trigger = screen.getByRole("combobox", { name: "Timer category" });
    await user.click(trigger);
    expect(await screen.findByRole("listbox")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    // The picker's menu is gone, the panel dialog is untouched, and the
    // panel's own onClose was never called.
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Project settings" })).toBeInTheDocument();
    expect(onPanelClose).not.toHaveBeenCalled();
  });

  test("a pointerdown outside the trigger and menu closes it", async () => {
    stubDefaultRects();
    const user = userEvent.setup();

    render(
      <div>
        <button type="button">elsewhere</button>
        <CategoryPicker categories={categories} value={undefined} onChange={vi.fn()} />
      </div>,
    );

    await user.click(screen.getByRole("combobox", { name: "Category" }));
    expect(await screen.findByRole("listbox")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "elsewhere" }));

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  test("arrow keys move the highlight and Enter selects the highlighted option", async () => {
    stubDefaultRects();
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<CategoryPicker categories={categories} value={undefined} onChange={onChange} />);

    await user.click(screen.getByRole("combobox", { name: "Category" }));
    await screen.findByRole("listbox");

    // Starting index is -1 (nothing highlighted yet); down twice lands on the
    // second option ("Admin").
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");

    expect(onChange).toHaveBeenCalledWith("cat-2");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  test("Enter on the already-current (disabled) option is a no-op, matching the pointer path", async () => {
    stubDefaultRects();
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<CategoryPicker categories={categories} value="cat-1" onChange={onChange} />);

    await user.click(screen.getByRole("combobox", { name: "Category" }));
    await screen.findByRole("listbox");

    // First option is the current selection ("Focus Work" / cat-1).
    await user.keyboard("{ArrowDown}{Enter}");

    expect(onChange).not.toHaveBeenCalled();
    // The menu stays open, same as clicking the disabled option would leave it.
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  test("does not flip above when the actual (short) menu fits below, even under the old 256px assumption", async () => {
    const originalInnerHeight = window.innerHeight;
    Object.defineProperty(window, "innerHeight", { value: 400, configurable: true });
    // Only 200px remain below the trigger — under the old hardcoded 256px
    // threshold this would have wrongly flipped up, even though the real
    // 2-option menu (~80px) fits comfortably.
    stubRects({
      trigger: () => ({ top: 200, bottom: 200, left: 20, right: 100, width: 80, height: 0 }),
      menu: () => ({ height: 80, width: 192 }),
    });

    const user = userEvent.setup();
    render(<CategoryPicker categories={[categories[0], categories[1]]} value={undefined} onChange={vi.fn()} />);

    await user.click(screen.getByRole("combobox", { name: "Category" }));
    const menu = await screen.findByRole("listbox");

    expect(menu.style.top).not.toBe("");
    expect(menu.style.bottom).toBe("");

    Object.defineProperty(window, "innerHeight", { value: originalInnerHeight, configurable: true });
  });

  test("flips above when the actual menu doesn't fit below", async () => {
    const originalInnerHeight = window.innerHeight;
    Object.defineProperty(window, "innerHeight", { value: 400, configurable: true });
    stubRects({
      trigger: () => ({ top: 350, bottom: 380, left: 20, right: 100, width: 80, height: 30 }),
      menu: () => ({ height: 120, width: 192 }),
    });

    const user = userEvent.setup();
    render(<CategoryPicker categories={categories} value={undefined} onChange={vi.fn()} />);

    await user.click(screen.getByRole("combobox", { name: "Category" }));
    const menu = await screen.findByRole("listbox");

    expect(menu.style.bottom).not.toBe("");
    expect(menu.style.top).toBe("");

    Object.defineProperty(window, "innerHeight", { value: originalInnerHeight, configurable: true });
  });

  test("clamps the menu horizontally so it never overflows the viewport", async () => {
    const originalInnerWidth = window.innerWidth;
    Object.defineProperty(window, "innerWidth", { value: 1024, configurable: true });
    // Trigger sits hard against the right edge — a naive left-anchored menu
    // at least MIN_WIDTH (192) wide would run off the viewport.
    stubRects({
      trigger: () => ({ top: 100, bottom: 132, left: 990, right: 1010, width: 20, height: 32 }),
      menu: () => ({ height: 100, width: 192 }),
    });

    const user = userEvent.setup();
    render(<CategoryPicker categories={categories} value={undefined} onChange={vi.fn()} />);

    await user.click(screen.getByRole("combobox", { name: "Category" }));
    const menu = await screen.findByRole("listbox");

    const left = parseFloat(menu.style.left);
    const width = parseFloat(menu.style.width);
    expect(left + width).toBeLessThanOrEqual(1024);
    expect(left).toBeGreaterThanOrEqual(0);

    Object.defineProperty(window, "innerWidth", { value: originalInnerWidth, configurable: true });
  });

  test("closes when the trigger scrolls entirely out of the viewport", async () => {
    let triggerRect = { top: 100, bottom: 132, left: 20, right: 100, width: 80, height: 32 };
    stubRects({
      trigger: () => triggerRect,
      menu: () => ({ height: 120, width: 192 }),
    });

    const user = userEvent.setup();
    render(<CategoryPicker categories={categories} value={undefined} onChange={vi.fn()} />);

    await user.click(screen.getByRole("combobox", { name: "Category" }));
    expect(await screen.findByRole("listbox")).toBeInTheDocument();

    // The trigger has scrolled up past the top of the viewport.
    triggerRect = { top: -300, bottom: -268, left: 20, right: 100, width: 80, height: 32 };
    fireEvent.scroll(window);

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  test("clicking an option selects it and closes the menu", async () => {
    stubDefaultRects();
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<CategoryPicker categories={categories} value={undefined} onChange={onChange} />);

    await user.click(screen.getByRole("combobox", { name: "Category" }));
    await screen.findByRole("listbox");

    await user.click(screen.getByRole("option", { name: "Admin" }));

    expect(onChange).toHaveBeenCalledWith("cat-2");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});

describe("TaskPicker portal menu", () => {
  test("search input filters the task list", async () => {
    stubDefaultRects();
    const user = userEvent.setup();

    render(<TaskPicker tasks={tasks} projects={[]} value={undefined} onChange={vi.fn()} />);

    await user.click(screen.getByRole("combobox", { name: "Task" }));
    await screen.findByRole("listbox");

    expect(screen.getByText("Write the plan")).toBeInTheDocument();
    expect(screen.getByText("Write the tests")).toBeInTheDocument();
    expect(screen.getByText("Review the PR")).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("Search tasks…"), "review");

    expect(screen.queryByText("Write the plan")).not.toBeInTheDocument();
    expect(screen.getByText("Review the PR")).toBeInTheDocument();
  });

  test("Escape from inside the search field closes the menu and returns focus to the trigger", async () => {
    stubDefaultRects();
    const user = userEvent.setup();

    render(<TaskPicker tasks={tasks} projects={[]} value={undefined} onChange={vi.fn()} />);

    const trigger = screen.getByRole("combobox", { name: "Task" });
    await user.click(trigger);
    const search = await screen.findByPlaceholderText("Search tasks…");
    expect(search).toHaveFocus();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  test("the highlighted index clamps when a search query narrows the list", async () => {
    stubDefaultRects();
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<TaskPicker tasks={tasks} projects={[]} value={undefined} onChange={onChange} />);

    await user.click(screen.getByRole("combobox", { name: "Task" }));
    await screen.findByRole("listbox");

    // Highlight the last (3rd) of 3 open tasks.
    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}");
    // Narrow to a single match — the stale index-2 highlight must clamp to
    // index 0 rather than pointing past the end and swallowing Enter.
    await user.type(screen.getByPlaceholderText("Search tasks…"), "review");
    await user.keyboard("{Enter}");

    expect(onChange).toHaveBeenCalledWith("task-3");
  });

  test("Enter on the already-current (disabled) task is a no-op, matching the pointer path", async () => {
    stubDefaultRects();
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<TaskPicker tasks={tasks} projects={[]} value="task-1" onChange={onChange} />);

    await user.click(screen.getByRole("combobox", { name: "Task" }));
    await screen.findByRole("listbox");

    await user.keyboard("{ArrowDown}{Enter}");

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  test("Tab from the search input closes the menu instead of leaving it open with focus gone", async () => {
    stubDefaultRects();
    const user = userEvent.setup();

    render(
      <div>
        <TaskPicker tasks={tasks} projects={[]} value={undefined} onChange={vi.fn()} />
      </div>,
    );

    const trigger = screen.getByRole("combobox", { name: "Task" });
    await user.click(trigger);
    const search = await screen.findByPlaceholderText("Search tasks…");
    expect(search).toHaveFocus();

    // Options are tabIndex={-1} and the portal is the last node in the
    // document, so there is nowhere for Tab to land inside the menu.
    await user.tab();

    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
  });

  test("clicking an option selects it and closes the menu", async () => {
    stubDefaultRects();
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<TaskPicker tasks={tasks} projects={[]} value={undefined} onChange={onChange} />);

    await user.click(screen.getByRole("combobox", { name: "Task" }));
    await screen.findByRole("listbox");

    await user.click(screen.getByRole("option", { name: /Review the PR/ }));

    expect(onChange).toHaveBeenCalledWith("task-3");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  test("clicking dead space inside the menu (the empty-state message) keeps the menu open and preserves the query", async () => {
    stubDefaultRects();
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<TaskPicker tasks={tasks} projects={[]} value={undefined} onChange={onChange} />);

    await user.click(screen.getByRole("combobox", { name: "Task" }));
    const search = await screen.findByPlaceholderText("Search tasks…");

    // A query with no matches renders the non-focusable "No open tasks
    // match." message — the same shape of interior dead space as the
    // menu's own padding. Clicking it (a mousedown on a non-focusable
    // element) blurs the search input in real browsers before our own
    // pointerdown handler's contains() exemption runs; the menu must not
    // treat that as an outside dismissal.
    await user.type(search, "no such task");
    const deadSpace = await screen.findByText("No open tasks match.");

    await user.click(deadSpace);

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search tasks…")).toHaveValue("no such task");
  });
});
