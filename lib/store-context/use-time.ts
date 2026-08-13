"use client";

import { useCallback, useMemo, useState } from "react";
import type { TimeEntry } from "../types";
import { request, RequestFailed } from "./request";

export type TimerConflictState = { taskId: string; runningTaskId: string };

export type TimeApi = {
  timeEntries: TimeEntry[];
  setTimeEntries: React.Dispatch<React.SetStateAction<TimeEntry[]>>;
  running: TimeEntry | null;
  setRunning: React.Dispatch<React.SetStateAction<TimeEntry | null>>;
  /** Set when a start was refused because another task is already being timed. */
  timerConflict: TimerConflictState | null;
  dismissTimerConflict: () => void;
  recordedMinutes: (taskId: string) => number;
  entriesFor: (taskId: string) => TimeEntry[];
  startTimer: (taskId: string) => Promise<void>;
  /** Stops whatever is running and starts `taskId` in one server-side step. */
  switchTimer: (taskId: string) => Promise<void>;
  stopTimer: () => Promise<void>;
  addManualEntry: (input: {
    taskId: string;
    startedAt: string;
    minutes: number;
    note?: string;
  }) => Promise<void>;
  patchTimeEntry: (
    id: string,
    patch: { startedAt?: string; minutes?: number; note?: string },
  ) => Promise<void>;
  deleteTimeEntry: (id: string) => Promise<void>;
};

export function useTime(onError: (message: string) => void): TimeApi {
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [running, setRunning] = useState<TimeEntry | null>(null);
  const [timerConflict, setTimerConflict] = useState<TimerConflictState | null>(null);

  /** Stopped and manual entries only — a live timer is shown, not totalled. */
  const totals = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of timeEntries) {
      if (!entry.endedAt || !entry.minutes) continue;
      map.set(entry.taskId, (map.get(entry.taskId) ?? 0) + entry.minutes);
    }
    return map;
  }, [timeEntries]);

  const recordedMinutes = useCallback((taskId: string) => totals.get(taskId) ?? 0, [totals]);

  const entriesFor = useCallback(
    (taskId: string) =>
      timeEntries
        .filter((e) => e.taskId === taskId)
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
    [timeEntries],
  );

  const startTimer = useCallback(
    async (taskId: string) => {
      try {
        const entry = await request<TimeEntry>("/api/time-entries", {
          method: "POST",
          body: JSON.stringify({ taskId }),
        });
        setRunning(entry);
        setTimeEntries((prev) => [entry, ...prev]);
      } catch (error) {
        // 409 isn't a failure to report and forget — it's a decision to offer.
        if (error instanceof RequestFailed && error.status === 409 && error.runningTaskId) {
          setTimerConflict({ taskId, runningTaskId: error.runningTaskId });
          return;
        }
        onError((error as Error).message);
      }
    },
    [onError],
  );

  const switchTimer = useCallback(
    async (taskId: string) => {
      try {
        const { stopped, started } = await request<{ stopped: TimeEntry | null; started: TimeEntry }>(
          "/api/time-entries",
          { method: "POST", body: JSON.stringify({ taskId, replaceRunning: true }) },
        );
        setRunning(started);
        setTimeEntries((prev) => [
          started,
          ...prev.map((e) => (stopped && e.id === stopped.id ? stopped : e)),
        ]);
        setTimerConflict(null);
      } catch (error) {
        onError((error as Error).message);
      }
    },
    [onError],
  );

  const stopTimer = useCallback(async () => {
    try {
      const stopped = await request<TimeEntry>("/api/time-entries/stop", { method: "POST" });
      setRunning(null);
      setTimeEntries((prev) => prev.map((e) => (e.id === stopped.id ? stopped : e)));
    } catch (error) {
      onError((error as Error).message);
    }
  }, [onError]);

  const addManualEntry = useCallback<TimeApi["addManualEntry"]>(
    async (input) => {
      try {
        const entry = await request<TimeEntry>("/api/time-entries", {
          method: "POST",
          body: JSON.stringify(input),
        });
        setTimeEntries((prev) => [entry, ...prev]);
      } catch (error) {
        onError((error as Error).message);
      }
    },
    [onError],
  );

  const patchTimeEntry = useCallback<TimeApi["patchTimeEntry"]>(
    async (id, patch) => {
      let before: TimeEntry[] = [];
      setTimeEntries((prev) => {
        before = prev;
        return prev.map((e) => (e.id === id ? { ...e, ...patch } : e));
      });
      try {
        const saved = await request<TimeEntry>(`/api/time-entries/${id}`, {
          method: "PATCH",
          body: JSON.stringify(patch),
        });
        setTimeEntries((prev) => prev.map((e) => (e.id === id ? saved : e)));
      } catch (error) {
        setTimeEntries(before);
        onError((error as Error).message);
      }
    },
    [onError],
  );

  const deleteTimeEntry = useCallback(
    async (id: string) => {
      let before: TimeEntry[] = [];
      setTimeEntries((prev) => {
        before = prev;
        return prev.filter((e) => e.id !== id);
      });
      try {
        await request(`/api/time-entries/${id}`, { method: "DELETE" });
      } catch (error) {
        setTimeEntries(before);
        onError((error as Error).message);
      }
    },
    [onError],
  );

  return {
    timeEntries,
    setTimeEntries,
    running,
    setRunning,
    timerConflict,
    dismissTimerConflict: useCallback(() => setTimerConflict(null), []),
    recordedMinutes,
    entriesFor,
    startTimer,
    switchTimer,
    stopTimer,
    addManualEntry,
    patchTimeEntry,
    deleteTimeEntry,
  };
}
