"use client";

import { useCallback, useState } from "react";
import type { Project, ProjectStage, Task, TaskInput } from "../types";
import { request } from "./request";

type AddOptions = { projectId?: string; stageId?: string; scheduled?: string };

export type TasksApi = {
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  addTask: (text: string, opts?: AddOptions) => Promise<Task | null>;
  patchTask: (id: string, patch: Partial<TaskInput>) => Promise<void>;
  moveTask: (id: string, stageId: string, index: number) => Promise<void>;
  completeTask: (id: string) => Promise<void>;
  reopenTask: (id: string) => Promise<void>;
  trashTask: (id: string) => Promise<void>;
  reorderTasks: (ids: string[]) => Promise<void>;
  addSubtask: (taskId: string, title: string) => Promise<void>;
  toggleSubtask: (taskId: string, subtaskId: string, done: boolean) => Promise<void>;
  deleteSubtask: (taskId: string, subtaskId: string) => Promise<void>;
  addProject: (name: string, color?: string) => Promise<Project>;
  updateProject: (id: string, patch: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
};

export function useTasksState(
  onError: (message: string) => void,
  onStagesCreated: (stages: ProjectStage[]) => void,
): TasksApi {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  const addTask = useCallback(
    async (text: string, opts?: AddOptions) => {
      const raw = text.trim();
      if (!raw) return null;
      try {
        const created = await request<Task>("/api/tasks", {
          method: "POST",
          body: JSON.stringify({ text: raw, ...opts }),
        });
        setTasks((prev) => [...prev, created]);
        return created;
      } catch (error) {
        onError((error as Error).message);
        throw error;
      }
    },
    [onError],
  );

  const patchTask = useCallback(
    async (id: string, patch: Partial<TaskInput>) => {
      let before: Task[] = [];
      setTasks((prev) => {
        before = prev;
        return prev.map((t) => (t.id === id ? { ...t, ...patch } : t));
      });
      try {
        const saved = await request<Task>(`/api/tasks/${id}`, {
          method: "PATCH",
          body: JSON.stringify(patch),
        });
        setTasks((prev) => prev.map((t) => (t.id === id ? saved : t)));
      } catch (error) {
        setTasks(before);
        onError((error as Error).message);
      }
    },
    [onError],
  );

  /**
   * A board drop. Optimism here is deterministic — the card is already where
   * the user dropped it — so the whole list is restored on failure and the
   * card visibly returns to its old column.
   */
  const moveTask = useCallback(
    async (id: string, stageId: string, index: number) => {
      let before: Task[] = [];
      setTasks((prev) => {
        before = prev;
        return prev.map((t) => (t.id === id ? { ...t, stageId, boardOrder: index } : t));
      });
      try {
        const saved = await request<Task>(`/api/tasks/${id}/move`, {
          method: "POST",
          body: JSON.stringify({ stageId, index }),
        });
        // The server renumbers both columns, so take its ordering wholesale.
        const fresh = await request<Task[]>("/api/tasks");
        setTasks(fresh);
        return void saved;
      } catch (error) {
        setTasks(before);
        onError((error as Error).message);
      }
    },
    [onError],
  );

  const completeTask = useCallback(
    async (id: string) => {
      let before: Task[] = [];
      setTasks((prev) => {
        before = prev;
        return prev.map((t) =>
          t.id === id ? { ...t, status: "done" as const, completedAt: new Date().toISOString() } : t,
        );
      });
      try {
        const saved = await request<{ task: Task; next: Task | null }>(
          `/api/tasks/${id}/complete`,
          { method: "POST" },
        );
        setTasks((prev) => {
          const next = prev.map((t) => (t.id === id ? saved.task : t));
          return saved.next ? [...next, saved.next] : next;
        });
      } catch (error) {
        setTasks(before);
        onError((error as Error).message);
      }
    },
    [onError],
  );

  const reopenTask = useCallback(
    async (id: string) => {
      let before: Task[] = [];
      setTasks((prev) => {
        before = prev;
        return prev.map((t) =>
          t.id === id ? { ...t, status: "open" as const, completedAt: undefined } : t,
        );
      });
      try {
        const saved = await request<Task>(`/api/tasks/${id}/reopen`, { method: "POST" });
        setTasks((prev) => prev.map((t) => (t.id === id ? saved : t)));
      } catch (error) {
        setTasks(before);
        onError((error as Error).message);
      }
    },
    [onError],
  );

  const trashTask = useCallback(
    async (id: string) => {
      let before: Task[] = [];
      setTasks((prev) => {
        before = prev;
        return prev.filter((t) => t.id !== id);
      });
      try {
        await request(`/api/tasks/${id}`, { method: "DELETE" });
      } catch (error) {
        setTasks(before);
        onError((error as Error).message);
      }
    },
    [onError],
  );

  const reorderTasks = useCallback(
    async (ids: string[]) => {
      let before: Task[] = [];
      const order = new Map(ids.map((id, i) => [id, i]));
      setTasks((prev) => {
        before = prev;
        return prev.map((t) => (order.has(t.id) ? { ...t, sortOrder: order.get(t.id)! } : t));
      });
      try {
        await request("/api/tasks/reorder", { method: "POST", body: JSON.stringify({ ids }) });
      } catch (error) {
        setTasks(before);
        onError((error as Error).message);
      }
    },
    [onError],
  );

  const addSubtask = useCallback(
    async (taskId: string, title: string) => {
      try {
        const sub = await request(`/api/tasks/${taskId}/subtasks`, {
          method: "POST",
          body: JSON.stringify({ title }),
        });
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId ? { ...t, subtasks: [...t.subtasks, sub as never] } : t,
          ),
        );
      } catch (error) {
        onError((error as Error).message);
      }
    },
    [onError],
  );

  const toggleSubtask = useCallback(
    async (taskId: string, subtaskId: string, done: boolean) => {
      let before: Task[] = [];
      setTasks((prev) => {
        before = prev;
        return prev.map((t) =>
          t.id === taskId
            ? { ...t, subtasks: t.subtasks.map((s) => (s.id === subtaskId ? { ...s, done } : s)) }
            : t,
        );
      });
      try {
        await request(`/api/tasks/${taskId}/subtasks/${subtaskId}`, {
          method: "PATCH",
          body: JSON.stringify({ done }),
        });
      } catch (error) {
        setTasks(before);
        onError((error as Error).message);
      }
    },
    [onError],
  );

  const deleteSubtask = useCallback(
    async (taskId: string, subtaskId: string) => {
      let before: Task[] = [];
      setTasks((prev) => {
        before = prev;
        return prev.map((t) =>
          t.id === taskId
            ? { ...t, subtasks: t.subtasks.filter((s) => s.id !== subtaskId) }
            : t,
        );
      });
      try {
        await request(`/api/tasks/${taskId}/subtasks/${subtaskId}`, { method: "DELETE" });
      } catch (error) {
        setTasks(before);
        onError((error as Error).message);
      }
    },
    [onError],
  );

  const addProject = useCallback(
    async (name: string, color?: string) => {
      const { project, stages } = await request<{ project: Project; stages: ProjectStage[] }>(
        "/api/projects",
        { method: "POST", body: JSON.stringify({ name, color }) },
      );
      setProjects((prev) => [...prev, project]);
      onStagesCreated(stages);
      return project;
    },
    [onStagesCreated],
  );

  const updateProject = useCallback(
    async (id: string, patch: Partial<Project>) => {
      let before: Project[] = [];
      setProjects((prev) => {
        before = prev;
        return prev.map((p) => (p.id === id ? { ...p, ...patch } : p));
      });
      try {
        await request(`/api/projects/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
      } catch (error) {
        setProjects(before);
        onError((error as Error).message);
      }
    },
    [onError],
  );

  const deleteProject = useCallback(
    async (id: string) => {
      let beforeProjects: Project[] = [];
      let beforeTasks: Task[] = [];
      setProjects((prev) => {
        beforeProjects = prev;
        return prev.filter((p) => p.id !== id);
      });
      setTasks((prev) => {
        beforeTasks = prev;
        return prev.map((t) =>
          t.projectId === id ? { ...t, projectId: undefined, stageId: undefined } : t,
        );
      });
      try {
        await request(`/api/projects/${id}`, { method: "DELETE" });
      } catch (error) {
        setProjects(beforeProjects);
        setTasks(beforeTasks);
        onError((error as Error).message);
      }
    },
    [onError],
  );

  return {
    tasks,
    setTasks,
    projects,
    setProjects,
    addTask,
    patchTask,
    moveTask,
    completeTask,
    reopenTask,
    trashTask,
    reorderTasks,
    addSubtask,
    toggleSubtask,
    deleteSubtask,
    addProject,
    updateProject,
    deleteProject,
  };
}
