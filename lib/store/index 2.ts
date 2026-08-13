import * as note from "./note";
import * as projects from "./projects";
import * as quickTodos from "./quick-todos";
import * as stages from "./stages";
import * as tasks from "./tasks";
import * as time from "./time";

export { StageConflict } from "./stages";
export { TaskInvariantError } from "./tasks";
export { TimerConflict, elapsedMinutes } from "./time";

/**
 * One workspace-facing surface over the domain modules. Route handlers talk to
 * this; the modules own their own SQL and invariants.
 */
export const store = {
  ...tasks,
  ...projects,
  ...stages,
  ...note,
  ...quickTodos,
  ...time,
};
