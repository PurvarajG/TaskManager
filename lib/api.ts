import { StageConflict, TaskInvariantError, TimerConflict } from "./store";
import { Invalid } from "./validate";

/**
 * One place that decides which failures are the caller's fault (400), which are
 * missing records (404), which are invariant collisions (409), and which are
 * ours (500 — logged here, never echoed to the client, so database details
 * don't leak into a response body).
 */
export async function handle<T>(fn: () => Promise<T>, status = 200): Promise<Response> {
  try {
    const result = await fn();
    if (result === null || result === undefined) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    return Response.json(result, { status });
  } catch (error) {
    if (error instanceof Invalid || error instanceof TaskInvariantError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof TimerConflict) {
      return Response.json(
        { error: error.message, runningTaskId: error.runningTaskId },
        { status: 409 },
      );
    }
    if (error instanceof StageConflict) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    console.error("Unhandled API failure", error);
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function json(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new Invalid("Expected a JSON body");
  }
}
