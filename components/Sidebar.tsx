"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useTasks } from "@/lib/store-context";
import { PROJECT_COLORS } from "@/lib/types";
import ThemeToggle from "./ThemeToggle";
import LogoutButton from "./LogoutButton";

const NAV = [
  { label: "Today", href: "/" },
  { label: "Calendar", href: "/calendar" },
  { label: "Next 7 Days", href: "/upcoming" },
  { label: "All Tasks", href: "/all" },
  { label: "Completed", href: "/completed" },
  { label: "Trash", href: "/trash" },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { tasks, projects, addProject, deleteProject } = useTasks();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [q, setQ] = useState("");

  const openCounts = new Map<string, number>();
  for (const t of tasks) {
    if (t.status !== "open" || !t.projectId) continue;
    openCounts.set(t.projectId, (openCounts.get(t.projectId) ?? 0) + 1);
  }

  async function createProject() {
    const trimmed = name.trim();
    if (!trimmed) {
      setAdding(false);
      return;
    }
    const color = PROJECT_COLORS[projects.length % PROJECT_COLORS.length];
    const project = await addProject(trimmed, color);
    setName("");
    setAdding(false);
    router.push(`/projects/${project.id}`);
    onNavigate?.();
  }

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = q.trim();
          if (!trimmed) return;
          router.push(`/search?q=${encodeURIComponent(trimmed)}`);
          onNavigate?.();
        }}
        className="mb-6"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search"
          className="h-9 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-accent/40 focus:ring-2 focus:ring-accent/20"
        />
      </form>

      <nav className="flex flex-col gap-1">
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-muted font-semibold text-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-8">
        <div className="flex items-center justify-between px-3">
          <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
            Projects
          </span>
          <button
            onClick={() => setAdding(true)}
            aria-label="New project"
            className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            +
          </button>
        </div>

        <div className="mt-2 flex flex-col gap-0.5">
          {projects
            .filter((p) => !p.archived)
            .map((p) => {
              const active = pathname === `/projects/${p.id}`;
              return (
                <div key={p.id} className="group relative flex items-center">
                  <Link
                    href={`/projects/${p.id}`}
                    onClick={onNavigate}
                    className={`flex flex-1 items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                      active
                        ? "bg-muted font-semibold text-foreground"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    }`}
                  >
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ background: p.color }}
                    />
                    <span className="truncate">{p.name}</span>
                    {(openCounts.get(p.id) ?? 0) > 0 && (
                      <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground">
                        {openCounts.get(p.id)}
                      </span>
                    )}
                  </Link>
                  <button
                    onClick={() => {
                      if (confirm(`Delete "${p.name}"? Tasks move to no project.`)) {
                        deleteProject(p.id);
                      }
                    }}
                    aria-label={`Delete ${p.name}`}
                    className="absolute right-1 hidden size-5 items-center justify-center rounded text-muted-foreground hover:bg-border hover:text-foreground group-hover:flex"
                  >
                    ×
                  </button>
                </div>
              );
            })}

          {adding && (
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void createProject();
                if (e.key === "Escape") {
                  setAdding(false);
                  setName("");
                }
              }}
              onBlur={() => void createProject()}
              placeholder="Project name"
              className="mx-1 mt-1 h-8 rounded-lg border border-border bg-card px-2.5 text-sm outline-none focus:border-accent/40"
            />
          )}
        </div>
      </div>
    </>
  );
}

/**
 * Deliberately quiet on desktop: search, five smart views, projects, done.
 * Below `sm` it collapses to a top bar with a slide-over so phones keep full
 * navigation without losing the task list to chrome.
 */
export default function Sidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <aside className="hidden w-60 shrink-0 border-r border-border px-5 py-10 sm:flex sm:flex-col">
        <div className="flex items-center justify-between px-1">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="size-6 rounded-lg bg-gradient-to-br from-accent to-accent-secondary shadow-accent" />
            <span className="font-display text-lg">Today</span>
          </Link>
          <ThemeToggle />
        </div>

        <div className="mt-10 flex-1">
          <NavLinks />
        </div>
        <div className="border-t border-border pt-3">
          <LogoutButton />
        </div>
      </aside>

      <header className="flex items-center justify-between border-b border-border px-4 py-3 sm:hidden">
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="flex size-9 items-center justify-center rounded-lg text-foreground hover:bg-muted"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
        <Link href="/" className="flex items-center gap-2">
          <span className="size-5 rounded-md bg-gradient-to-br from-accent to-accent-secondary" />
          <span className="font-display text-base">Today</span>
        </Link>
        <ThemeToggle />
      </header>

      {open && (
        <div className="fixed inset-0 z-50 sm:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 overflow-y-auto bg-background px-5 py-6 shadow-xl">
            <div className="flex items-center justify-between px-1">
              <span className="font-display text-lg">Today</span>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
              >
                ×
              </button>
            </div>
            <div className="mt-8">
              <NavLinks onNavigate={() => setOpen(false)} />
            </div>
            <div className="mt-8 border-t border-border pt-3">
              <LogoutButton onLogout={() => setOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
