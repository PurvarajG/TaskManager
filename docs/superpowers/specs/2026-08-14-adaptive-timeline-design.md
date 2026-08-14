# Adaptive Today Timeline Design

## Correction

The prior dashboard component was a compressed calendar. This revision replaces
it with a genuine timeline: a single horizontal time axis, vertical lanes, and
task bars positioned along the relevant scale.

## Adaptive scale

The existing range slider retains snap points of 1, 2, 3, 5, 7, 10, and 14
days, but changes the timeline scale rather than merely the number of columns.

- **1 day:** a single day lane with an hour header from the planning day start
  through `DAY_END_HOUR`. A task with `dueTime` renders as a bar whose left
  edge is its due time and whose width represents its `minutes`. A task without
  a due time is collected in an unscheduled strip below the hour lane.
- **2–3 days:** each day is a horizontal lane sharing the same hour columns.
  Tasks remain time-positioned bars; each day has a labelled lane header.
- **5–14 days:** the canvas switches to day-scale columns. Tasks render as
  compact horizontal bars/markers in project lanes, placed on their scheduled
  date. This preserves a readable roadmap orientation at wider zoom levels.

## Canvas and interaction

- The timeline header shows the active date range, a previous/next control
  that shifts by the selected span, and the range slider.
- Grid lines correspond to time increments in hour mode and whole days in
  day mode. Today is visibly highlighted, and hour-scale modes show a vertical
  current-time line when the visible range includes today.
- Task bars use their project colour, display a truncated title, and open the
  existing task detail panel when selected. The layout is display-only: no
  drag-to-reschedule behavior is introduced.
- A task's scheduling semantics do not change. `dueTime` is used as its
  display start time when present; `minutes` is its display duration.

## Layout and responsiveness

- The dashboard continues to use the bounded desktop workspace, keeping the
  adaptive timeline visible in its lower region and using internal scroll only
  in task-heavy utility panels.
- The timeline canvas has horizontal overflow rather than compressing its hour
  grid below legibility. On mobile, the page retains natural vertical scrolling
  and the canvas can scroll horizontally.

## Verification

- Unit/UI tests cover scale changes, time-positioned bar calculation, day-scale
  rendering, slider navigation, project colours, and task opening.
- Manually verify 1-, 3-, and 14-day modes with both timed and untimed tasks.
- Run lint and the relevant UI tests; report any unrelated suite or environment
  blockers separately.

## Self-review

- No new task data is required: `scheduled`, optional `dueTime`, and `minutes`
  define the timeline placement.
- The hour-to-day transition is explicit at the 5-day range, so the slider has
  a predictable change in scale.
- The scope remains presentation and interaction only; database and scheduling
  behavior are unchanged.
