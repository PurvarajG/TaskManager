"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Project, ProjectStage, Task, TaskInput } from "./types";

type AddOptions = { projectId?: string };

type TasksContextValue = {
  tasks: Task[];
  projects: Project[];
  ready: boolean;
  error: string | null;
  dismissError: () => void;
  addTask: (text: string, opts?: AddOptions) => Promise<void>;
  patchTask: (id: string, patch: Partial<TaskInput>) => Promise<void>;
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

const TasksContext = createContext<TasksContextValue | null>(null);

export function TasksProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/tasks").then((r) => r.json()),
      fetch("/api/projects").then((r) => r.json()),
    ])
      .then(([t, p]: [Task[], Project[]]) => {
        setTasks(t);
        setProjects(p);
      })
      .catch(() => setError("Couldn't load your tasks"))
      .finally(() => setReady(true));
  }, []);

  const dismissError = useCallback(() => setError(null), []);

  const addTask = useCallback(async (text: string, opts?: AddOptions) => {
    const raw = text.trim();
    if (!raw) return;
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: raw, projectId: opts?.projectId }),
      });
      if (!res.ok) throw new Error();
      const created = (await res.json()) as Task;
      setTasks((prev) => [...prev, created]);
    } catch {
      setError("Couldn't add that");
      throw new Error("add-failed");
    }
  }, []);

  const patchTask = useCallback(
    async (id: string, patch: Partial<TaskInput>) => {
      let before: Task[] = [];
      setTasks((prev) => {
        before = prev;
        return prev.map((t) => (t.id === id ? { ...t, ...patch } : t));
      });
      try {
        const res = await fetch(`/api/tasks/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) throw new Error();
        const saved = (await res.json()) as Task;
        setTasks((prev) => prev.map((t) => (t.id === id ? saved : t)));
      } catch {
        setTasks(before);
        setError("That didn't save");
      }
    },
    [],
  );

  const completeTask = useCallback(async (id: string) => {
    let before: Task[] = [];
    setTasks((prev) => {
      before = prev;
      return prev.map((t) =>
        t.id === id ? { ...t, status: "done" as const, completedAt: new Date().toISOString() } : t,
      );
    });
    try {
      const res = await fetch(`/api/tasks/${id}/complete`, { method: "POST" });
      if (!res.ok) throw new Error();
      const saved = (await res.json()) as { task: Task; next: Task | null };
      setTasks((prev) => {
        const next = prev.map((t) => (t.id === id ? saved.task : t));
        return saved.next ? [...next, saved.next] : next;
      });
    } catch {
      setTasks(before);
      setError("That didn't save");
    }
  }, []);

  const reopenTask = useCallback(async (id: string) => {
    let before: Task[] = [];
    setTasks((prev) => {
      before = prev;
      return prev.map((t) =>
        t.id === id ? { ...t, status: "open" as const, completedAt: undefined } : t,
      );
    });
    try {
      const res = await fetch(`/api/tasks/${id}/reopen`, { method: "POST" });
      if (!res.ok) throw new Error();
    } catch {
      setTasks(before);
      setError("That didn't save");
    }
  }, []);

  const trashTask = useCallback(async (id: string) => {
    let before: Task[] = [];
    setTasks((prev) => {
      before = prev;
      return prev.filter((t) => t.id !== id);
    });
    try {
      const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
    } catch {
      setTasks(before);
      setError("Couldn't delete that");
    }
  }, []);

  const reorderTasks = useCallback(async (ids: string[]) => {
    setTasks((prev) => {
      const order = new Map(ids.map((id, i) => [id, i]));
      return prev.map((t) =>
        order.has(t.id) ? { ...t, sortOrder: order.get(t.id)! } : t,
      );
    });
    try {
      const res = await fetch("/api/tasks/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setError("Order didn't save");
    }
  }, []);

  const addSubtask = useCallback(async (taskId: string, title: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/subtasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error();
      const sub = await res.json();
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, subtasks: [...t.subtasks, sub] } : t)),
      );
    } catch {
      setError("Couldn't add that subtask");
    }
  }, []);

  const toggleSubtask = useCallback(
    async (taskId: string, subtaskId: string, done: boolean) => {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                subtasks: t.subtasks.map((s) => (s.id === subtaskId ? { ...s, done } : s)),
              }
            : t,
        ),
      );
      try {
        const res = await fetch(`/api/tasks/${taskId}/subtasks/${subtaskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ done }),
        });
        if (!res.ok) throw new Error();
      } catch {
        setError("That didn't save");
      }
    },
    [],
  );

  const deleteSubtask = useCallback(async (taskId: string, subtaskId: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, subtasks: t.subtasks.filter((s) => s.id !== subtaskId) }
          : t,
      ),
    );
    try {
      const res = await fetch(`/api/tasks/${taskId}/subtasks/${subtaskId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
    } catch {
      setError("Couldn't delete that subtask");
    }
  }, []);

  const addProject = useCallback(async (name: string, color?: string) => {
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, color }),
    });
    if (!res.ok) throw new Error("add-project-failed");
    // A project always arrives with its default board attached.
    const { project } = (await res.json()) as { project: Project; stages: ProjectStage[] };
    setProjects((prev) => [...prev, project]);
    return project;
  }, []);

  const updateProject = useCallback(async (id: string, patch: Partial<Project>) => {
    let before: Project[] = [];
    setProjects((prev) => {
      before = prev;
      return prev.map((p) => (p.id === id ? { ...p, ...patch } : p));
    });
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error();
    } catch {
      setProjects(before);
      setError("That didn't save");
    }
  }, []);

  const deleteProject = useCallback(async (id: string) => {
    let before: Project[] = [];
    setProjects((prev) => {
      before = prev;
      return prev.filter((p) => p.id !== id);
    });
    setTasks((prev) => prev.map((t) => (t.projectId === id ? { ...t, projectId: undefined } : t)));
    try {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
    } catch {
      setProjects(before);
      setError("Couldn't delete that project");
    }
  }, []);

  const value = useMemo(
    () => ({
      tasks,
      projects,
      ready,
      error,
      dismissError,
      addTask,
      patchTask,
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
    }),
    [
      tasks,
      projects,
      ready,
      error,
      dismissError,
      addTask,
      patchTask,
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
    ],
  );

  return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>;
}

export function useTasks() {
  const ctx = useContext(TasksContext);
  if (!ctx) throw new Error("useTasks must be used within TasksProvider");
  return ctx;
}
