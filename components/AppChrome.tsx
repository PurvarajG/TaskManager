"use client";

import { usePathname } from "next/navigation";
import { TasksProvider } from "@/lib/store-context";
import Sidebar from "./Sidebar";
import Reminders from "./Reminders";
import TaskPanel from "./TaskPanel";
import TimerStrip from "./TimerStrip";
import TimerConflict from "./TimerConflict";
import ErrorToast from "./ErrorToast";

export default function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/login") return children;
  return (
    <TasksProvider>
      <div className="flex min-h-dvh flex-col sm:flex-row">
        <Sidebar />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
      {/* Mounted once, above every surface: any list, board, or calendar can
          open the same task panel without routing away. */}
      <TaskPanel />
      <TimerStrip />
      <TimerConflict />
      <ErrorToast />
      <Reminders />
    </TasksProvider>
  );
}
