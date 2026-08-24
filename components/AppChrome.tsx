"use client";

import { TasksProvider } from "@/lib/store-context";
import Sidebar from "./Sidebar";
import Reminders from "./Reminders";
import TaskPanel from "./TaskPanel";
import TimerStrip from "./TimerStrip";
import TimerConflict from "./TimerConflict";
import ErrorToast from "./ErrorToast";
import DesktopBridge from "./DesktopBridge";

export default function AppChrome({ children }: { children: React.ReactNode }) {
  return (
    <TasksProvider>
      <div className="flex min-h-dvh flex-row">
        <Sidebar />
        <main className="relative min-w-0 flex-1 bg-background">
          {/* Absolutely positioned, not in flow: every page already has top
              padding before its first real control (Today's lg:h-dvh layout
              in particular has none to spare), and this thin a strip sits
              entirely inside that empty padding rather than pushing content
              down or covering anything clickable. */}
          <div className="drag-region absolute inset-x-0 top-0 h-2" />
          {children}
        </main>
      </div>
      {/* Mounted once, above every surface: any list, board, or calendar can
          open the same task panel without routing away. */}
      <TaskPanel />
      <TimerStrip />
      <TimerConflict />
      <ErrorToast />
      <Reminders />
      <DesktopBridge />
    </TasksProvider>
  );
}
