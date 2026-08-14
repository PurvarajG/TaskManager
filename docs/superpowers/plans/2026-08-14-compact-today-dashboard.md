# Compact Today Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Today workspace show its key controls, timeline, and normal daily task load in a 1440 × 900 laptop viewport without document scrolling.

**Architecture:** Keep the existing responsive desktop shell and timeline. Reduce the desktop-only vertical rhythm in `Today`, move the timeline into the fixed visible workspace, and add an explicit compact rendering variant to `TaskRow` so other app pages retain their current density.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, Vitest, Testing Library.

## Global Constraints

- Do not change task, project, scheduling, or database contracts.
- The desktop target is a 1440 × 900 viewport below the app shell, with no document-level scrolling for a typical five-task day.
- Mobile continues to use normal vertically scrollable document flow.
- Only Chrome extensions, not app code, are implicated by the supplied `M_ID` and `bis_skin_checked` error evidence.

---

### Task 1: Specify and test the compact Today layout

**Files:**
- Modify: `tests/ui/dashboard-timeline.test.tsx`

- [ ] Add a failing test asserting the Today primary pane has the compact task-list marker and the existing bounded workspace/timeline markers.
- [ ] Run `npm run test:ui -- tests/ui/dashboard-timeline.test.tsx`; confirm the compact marker assertion fails.

### Task 2: Compact the visible desktop workspace

**Files:**
- Modify: `components/Today.tsx`
- Modify: `components/TaskRow.tsx`
- Modify: `components/QuickAdd.tsx`
- Modify: `components/today/GeneralNote.tsx`
- Test: `tests/ui/dashboard-timeline.test.tsx`

- [ ] Add a `compact` TaskRow option that reduces padding, metadata spacing, controls, and font size without changing default rows elsewhere.
- [ ] At the `lg` breakpoint, make Today’s header, quick-add, timeline, highlighted task, task-list spacing, side-panel gaps, and note height compact; use the compact TaskRow variant for the Today task list.
- [ ] Keep default and mobile class behavior readable and vertically scrollable.
- [ ] Run the focused UI test until it passes.

### Task 3: Verify the regression boundary

**Files:**
- Modify: `tests/ui/dashboard-timeline.test.tsx`

- [ ] Run `npm run test`, `npm run lint`, and `npm run build`.
- [ ] Inspect the final diff to ensure only Today-specific density is changed and unrelated workspace edits are preserved.
