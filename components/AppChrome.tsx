"use client";

import { usePathname } from "next/navigation";
import { TasksProvider } from "@/lib/store-context";
import Sidebar from "./Sidebar";
import Reminders from "./Reminders";

export default function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/login") return children;
  return (
    <TasksProvider>
      <div className="flex min-h-dvh flex-col sm:flex-row">
        <Sidebar />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
      <Reminders />
    </TasksProvider>
  );
}
