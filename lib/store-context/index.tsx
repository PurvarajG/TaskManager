"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type {
  GeneralNote,
  Project,
  ProjectStage,
  QuickTodo,
  Task,
  TimeEntry,
} from "../types";
import { useNote, type NoteApi } from "./use-note";
import { useQuickTodos, type QuickTodosApi } from "./use-quick-todos";
import { useStages, type StagesApi } from "./use-stages";
import { useTasksState, type TasksApi } from "./use-tasks";
import { useTime, type TimeApi } from "./use-time";

export { RequestFailed } from "./request";
export type { SaveState } from "./use-note";

type WorkspaceValue = TasksApi &
  StagesApi &
  NoteApi &
  QuickTodosApi &
  TimeApi & {
    ready: boolean;
    error: string | null;
    dismissError: () => void;
    /** The task open in the shared detail panel, if any. */
    openTaskId: string | null;
    openTask: (id: string) => void;
    closeTask: () => void;
  };

const WorkspaceContext = createContext<WorkspaceValue | null>(null);

export function TasksProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  const onError = useCallback((message: string) => setError(message), []);

  const stages = useStages(onError);
  const { setStages } = stages;
  const onStagesCreated = useCallback(
    (created: ProjectStage[]) => setStages((prev) => [...prev, ...created]),
    [setStages],
  );

  const tasks = useTasksState(onError, onStagesCreated);
  const note = useNote();
  const time = useTime(onError);

  const { setTasks } = tasks;
  const onTaskCreated = useCallback(
    (task: Task) => {
      setTasks((prev) => [...prev, task]);
      setOpenTaskId(task.id);
    },
    [setTasks],
  );
  const quickTodos = useQuickTodos(onError, onTaskCreated);

  const { setProjects } = tasks;
  const { loadNote } = note;
  const { setQuickTodos } = quickTodos;
  const { setTimeEntries, setRunning } = time;

  useEffect(() => {
    Promise.all([
      fetch("/api/tasks").then((r) => r.json()),
      fetch("/api/projects").then((r) => r.json()),
      fetch("/api/stages").then((r) => r.json()),
      fetch("/api/note").then((r) => r.json()),
      fetch("/api/quick-todos").then((r) => r.json()),
      fetch("/api/time-entries").then((r) => r.json()),
    ])
      .then(
        ([t, p, s, n, q, time]: [
          Task[],
          Project[],
          ProjectStage[],
          GeneralNote,
          QuickTodo[],
          { entries: TimeEntry[]; running: TimeEntry | null },
        ]) => {
          setTasks(t);
          setProjects(p);
          setStages(s);
          loadNote(n);
          setQuickTodos(q);
          setTimeEntries(time.entries);
          setRunning(time.running);
        },
      )
      .catch(() => setError("Couldn't load your workspace"))
      .finally(() => setReady(true));
  }, [setTasks, setProjects, setStages, loadNote, setQuickTodos, setTimeEntries, setRunning]);

  const dismissError = useCallback(() => setError(null), []);
  const openTask = useCallback((id: string) => setOpenTaskId(id), []);
  const closeTask = useCallback(() => setOpenTaskId(null), []);

  const value = useMemo(
    () => ({
      ...tasks,
      ...stages,
      ...note,
      ...quickTodos,
      ...time,
      ready,
      error,
      dismissError,
      openTaskId,
      openTask,
      closeTask,
    }),
    [tasks, stages, note, quickTodos, time, ready, error, dismissError, openTaskId, openTask, closeTask],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

/** Named for history: every surface reads the whole workspace from here. */
export function useTasks(): WorkspaceValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useTasks must be used within TasksProvider");
  return ctx;
}

export const useWorkspace = useTasks;
