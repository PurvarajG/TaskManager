"use client";

import { useCallback, useState } from "react";
import type { QuickTodo, Task } from "../types";
import { request } from "./request";

export type QuickTodosApi = {
  quickTodos: QuickTodo[];
  setQuickTodos: React.Dispatch<React.SetStateAction<QuickTodo[]>>;
  addQuickTodo: (title: string) => Promise<void>;
  patchQuickTodo: (id: string, patch: { title?: string; done?: boolean }) => Promise<void>;
  deleteQuickTodo: (id: string) => Promise<void>;
  reorderQuickTodos: (ids: string[]) => Promise<void>;
  convertQuickTodo: (id: string) => Promise<Task | null>;
};

export function useQuickTodos(
  onError: (message: string) => void,
  onTaskCreated: (task: Task) => void,
): QuickTodosApi {
  const [quickTodos, setQuickTodos] = useState<QuickTodo[]>([]);

  const addQuickTodo = useCallback(
    async (title: string) => {
      try {
        const created = await request<QuickTodo>("/api/quick-todos", {
          method: "POST",
          body: JSON.stringify({ title }),
        });
        setQuickTodos((prev) => [...prev, created]);
      } catch (error) {
        onError((error as Error).message);
      }
    },
    [onError],
  );

  const patchQuickTodo = useCallback(
    async (id: string, patch: { title?: string; done?: boolean }) => {
      let before: QuickTodo[] = [];
      setQuickTodos((prev) => {
        before = prev;
        return prev.map((t) => (t.id === id ? { ...t, ...patch } : t));
      });
      try {
        await request(`/api/quick-todos/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
      } catch (error) {
        setQuickTodos(before);
        onError((error as Error).message);
      }
    },
    [onError],
  );

  const deleteQuickTodo = useCallback(
    async (id: string) => {
      let before: QuickTodo[] = [];
      setQuickTodos((prev) => {
        before = prev;
        return prev.filter((t) => t.id !== id);
      });
      try {
        await request(`/api/quick-todos/${id}`, { method: "DELETE" });
      } catch (error) {
        setQuickTodos(before);
        onError((error as Error).message);
      }
    },
    [onError],
  );

  const reorderQuickTodos = useCallback(
    async (ids: string[]) => {
      let before: QuickTodo[] = [];
      const order = new Map(ids.map((id, i) => [id, i]));
      setQuickTodos((prev) => {
        before = prev;
        return prev.map((t) => (order.has(t.id) ? { ...t, sortOrder: order.get(t.id)! } : t));
      });
      try {
        await request("/api/quick-todos/reorder", {
          method: "POST",
          body: JSON.stringify({ ids }),
        });
      } catch (error) {
        setQuickTodos(before);
        onError((error as Error).message);
      }
    },
    [onError],
  );

  /** Waits for the server: the item is only removed once the task really exists. */
  const convertQuickTodo = useCallback(
    async (id: string) => {
      try {
        const task = await request<Task>(`/api/quick-todos/${id}/convert`, {
          method: "POST",
          body: JSON.stringify({}),
        });
        setQuickTodos((prev) => prev.filter((t) => t.id !== id));
        onTaskCreated(task);
        return task;
      } catch (error) {
        onError((error as Error).message);
        return null;
      }
    },
    [onError, onTaskCreated],
  );

  return {
    quickTodos,
    setQuickTodos,
    addQuickTodo,
    patchQuickTodo,
    deleteQuickTodo,
    reorderQuickTodos,
    convertQuickTodo,
  };
}
