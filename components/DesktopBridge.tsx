"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTasks } from "@/lib/store-context";
import type { TempoCommand } from "@/lib/desktop-bridge";

const ROUTE_BY_DIGIT: Record<string, string> = {
  "1": "/",
  "2": "/calendar",
  "3": "/tracking",
  "4": "/upcoming",
  "5": "/all",
};

function focusWhenReady(id: string, deadline = Date.now() + 1000) {
  const el = document.getElementById(id);
  if (el) {
    el.focus();
    return;
  }
  if (Date.now() < deadline) requestAnimationFrame(() => focusWhenReady(id, deadline));
}

/**
 * Mounted once in AppChrome beside the other cross-page singletons. Bridges
 * native menu/keyboard commands onto the same router and workspace actions
 * every page already uses — no command gets a state layer of its own.
 */
export default function DesktopBridge() {
  const router = useRouter();
  const { tasks, running, openTaskId, startTimer, stopTimer } = useTasks();

  // toggle-timer needs whatever is current when the command arrives, not
  // whatever was current when the subscription below was set up.
  const stateRef = useRef({ running, openTaskId, startTimer, stopTimer });
  useEffect(() => {
    stateRef.current = { running, openTaskId, startTimer, stopTimer };
  });

  useEffect(() => {
    function run(command: TempoCommand) {
      switch (command.type) {
        case "navigate":
          router.push(command.path);
          break;
        case "focus-search":
          focusWhenReady("tempo-sidebar-search");
          break;
        case "new-task":
          router.push("/");
          focusWhenReady("tempo-quick-add");
          break;
        case "toggle-timer": {
          const { running, openTaskId, startTimer, stopTimer } = stateRef.current;
          if (running) void stopTimer();
          else if (openTaskId) void startTimer(openTaskId);
          break;
        }
      }
    }

    if (window.tempo) return window.tempo.onCommand(run);

    // The web build has no native menu, so the same accelerators are wired
    // directly to the keyboard here instead. This branch never runs under
    // Electron — the menu already sends the matching command over IPC, and
    // handling both would fire every action twice.
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey)) return;
      const digitRoute = ROUTE_BY_DIGIT[event.key];
      if (digitRoute) {
        event.preventDefault();
        run({ type: "navigate", path: digitRoute });
      } else if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        run({ type: "new-task" });
      } else if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        run({ type: "focus-search" });
      } else if (event.key === ",") {
        event.preventDefault();
        run({ type: "navigate", path: "/settings" });
      } else if (event.shiftKey && event.key.toLowerCase() === "t") {
        event.preventDefault();
        run({ type: "toggle-timer" });
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [router]);

  // Dock badge tracks total open tasks — the same status Sidebar derives
  // per project, just summed instead of grouped.
  useEffect(() => {
    const openCount = tasks.filter((t) => t.status === "open").length;
    window.tempo?.setBadge(openCount);
  }, [tasks]);

  // Mirrors the running timer to the Tray title. Main ticks the displayed
  // elapsed time itself, so this only needs to fire on start/stop/switch.
  useEffect(() => {
    if (!running) {
      window.tempo?.setTimerStatus(null);
      return;
    }
    const task = tasks.find((t) => t.id === running.taskId);
    window.tempo?.setTimerStatus({ label: task?.title ?? "Timing", startedAt: running.startedAt });
  }, [running, tasks]);

  // Task ▸ Start/Stop Timer has nothing to act on unless a timer is running
  // or a task panel is open — keep the native menu item's enabled state in
  // sync so it can't be clicked (or fired via its accelerator) into a no-op.
  useEffect(() => {
    window.tempo?.setCanToggleTimer(Boolean(running || openTaskId));
  }, [running, openTaskId]);

  return null;
}
