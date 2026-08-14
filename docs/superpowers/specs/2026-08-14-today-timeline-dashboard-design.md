# Today Timeline Dashboard Design

## Goal

Turn the Today dashboard into a compact desktop workspace that fits a standard
1440 x 900 laptop viewport without document-level scrolling. Replace the
three-week calendar grid with an interactive task timeline that sits beneath
the notification/timer strip.

## Layout

- On large screens, the Today page fills the available viewport beneath the
  app chrome. Header, quick add, main work area, and timeline are arranged in
  a bounded vertical workspace.
- The current task work area and utility panels share the middle row. Long
  task lists scroll inside their panel rather than expanding the page.
- The timeline occupies the lower dashboard region and is always visible.
- On narrow screens, retain the existing natural, vertically scrolling layout
  so controls and task content stay usable.

## Timeline interaction

- Replace `ThreeWeekTimeline` with a horizontally oriented timeline card.
- A native range slider selects the displayed span. Its labelled snap points
  are 1, 2, 3, 5, 7, 10, and 14 days; dragging animates the column density and
  releasing settles on the nearest supported span.
- Previous and next controls move the visible date window by the currently
  selected span. The initial window begins on today.
- Each day is a compact column, with today visually highlighted. Scheduled
  tasks render as project-coloured, truncated task chips. Completed tasks are
  visually muted.
- Selecting a task opens its existing task detail surface. Selecting unused
  day space takes the user to the calendar for that date.

## Boundaries and compatibility

- This is a frontend-only change: task scheduling, project colours, task
  detail behavior, and calendar routes remain unchanged.
- The implementation consumes the existing task store and date helpers.
- Keyboard and pointer users can operate the slider and previous/next
  controls; reduced-motion preferences suppress decorative transitions.

## Verification

- Add focused UI coverage for range selection and date-window movement where
  the current test setup supports it.
- Run lint and the project test suite.
- Manually verify the dashboard at desktop and mobile breakpoints, including
  an empty timeline and days with more tasks than available chip space.
