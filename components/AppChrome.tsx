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
          {/* Absolutely positioned, not in flow: this h-9 band matches the
              sidebar's pt-9 titlebar height. In the Electron app,
              `-webkit-app-region: drag` is read into an annotated
              draggable-rect list that the native NSView hit-tests BEFORE
              the event ever reaches the renderer, so this band drags the
              window regardless of `pointer-events-none` — that property
              cannot and does not make it click-through there. Its actual
              job is the plain web build, where there is no native drag
              hit-test at all: without `pointer-events-none` this would be
              an ordinary absolute strip eating every click and text
              selection across the top 36px of every page. The ONLY thing
              that carves a hole out of the Electron drag rect is a
              later-painted element that itself declares `-webkit-app-
              region: no-drag` — see globals.css. Every page header whose
              content lands in this band must apply `.no-drag` to that
              content (see app/tracking/page.tsx and app/calendar/page.tsx). */}
          <div className="drag-region pointer-events-none absolute inset-x-0 top-0 h-9" />
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
