"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useTasks } from "@/lib/store-context";
import { PROJECT_COLORS } from "@/lib/types";
import ThemeToggle from "./ThemeToggle";
import TempoMark from "./TempoMark";

export const NAV = [
  { key: "today", label: "Today", href: "/" },
  { key: "calendar", label: "Calendar", href: "/calendar" },
  { key: "tracking", label: "Tracking", href: "/tracking" },
  { key: "upcoming", label: "Next 7 Days", href: "/upcoming" },
  { key: "all", label: "All Tasks", href: "/all" },
  { key: "completed", label: "Completed", href: "/completed" },
  { key: "trash", label: "Trash", href: "/trash" },
  { key: "settings", label: "Settings", href: "/settings" },
];

/** The one nav entry that can never be hidden — without it there is no way to undo hiding. */
export const UNHIDEABLE_NAV_KEY = "settings";

function NavLinks() {
  const pathname = usePathname();
  const router = useRouter();
  const { tasks, projects, addProject, deleteProject, settings } = useTasks();
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
  }

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = q.trim();
          if (!trimmed) return;
          router.push(`/search?q=${encodeURIComponent(trimmed)}`);
        }}
        className="relative mb-6"
      >
        <svg
          aria-hidden
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-nav-foreground/60"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          id="tempo-sidebar-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search"
          className="no-drag h-8 w-full rounded-[11px] border-none bg-nav-hover pl-7 pr-3 text-sm text-nav-foreground outline-none placeholder:text-nav-foreground/50 focus-visible:ring-2 focus-visible:ring-nav-active/50"
        />
      </form>

      <nav className="flex flex-col gap-0.5">
        {/* settings is null before the first fetch — show the full nav rather than flashing an empty sidebar. */}
        {(settings ? NAV.filter((item) => !settings.hiddenNavItems.includes(item.key)) : NAV).map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`no-drag rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
                active
                  ? "bg-nav-active font-semibold text-white"
                  : "font-medium text-nav-foreground hover:bg-nav-hover hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-8">
        <div className="no-drag flex items-center justify-between px-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-nav-foreground/70">
            Projects
          </span>
          <button
            onClick={() => setAdding(true)}
            aria-label="New project"
            className="flex size-5 items-center justify-center rounded text-nav-foreground hover:bg-nav-hover hover:text-white"
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
                <div key={p.id} className="no-drag group relative flex items-center">
                  <Link
                    href={`/projects/${p.id}`}
                    className={`flex flex-1 items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
                      active
                        ? "bg-nav-active font-semibold text-white"
                        : "font-medium text-nav-foreground hover:bg-nav-hover hover:text-white"
                    }`}
                  >
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ background: p.color }}
                    />
                    <span className="select-text truncate">{p.name}</span>
                    {(openCounts.get(p.id) ?? 0) > 0 && (
                      <span
                        className={`ml-auto shrink-0 font-mono text-[10px] ${active ? "text-white/70" : "text-nav-foreground/70"}`}
                      >
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
                    className="absolute right-1 hidden size-5 items-center justify-center rounded text-nav-foreground hover:bg-nav-hover hover:text-white group-hover:flex"
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
              className="no-drag mx-1 mt-1 h-8 rounded-lg border border-nav-hover bg-nav-hover px-2.5 text-sm text-white outline-none placeholder:text-nav-foreground/50 focus:border-nav-active/60"
            />
          )}
        </div>
      </div>
    </>
  );
}

/**
 * A macOS source list: search, five smart views, projects, done. The window
 * has a 900px minWidth floor, well above the old `sm` breakpoint this used
 * to collapse at, so there is no narrower state left to design for.
 */
export default function Sidebar() {
  return (
    <aside className="flex w-56 shrink-0 flex-col bg-nav pb-10 text-nav-foreground">
      {/* Full-width drag region: spans the h-9 titlebar band (`pt-9`)
          across the whole row, so the window can be grabbed anywhere along
          the sidebar's top, matching AppChrome's h-9 spacer convention.
          The branding ROW itself carries `.no-drag` (not just its two
          interactive children) so the row's live drag area is exactly the
          `pt-9` band — without that, the gaps between the logo, wordmark,
          and ThemeToggle would stay drag-live below the row's own y range,
          silently dragging the window (or blocking scrim dismissal) when
          clicked. The logo `Link` and `ThemeToggle` remain independently
          clickable regardless, since `.no-drag` on the row already covers
          them. */}
      <div className="drag-region flex flex-col px-5 pt-9">
        <div className="no-drag flex items-center justify-between px-1">
          <Link href="/" className="flex items-center gap-2.5 text-white">
            <TempoMark />
            <span className="font-display text-lg">Tempo</span>
          </Link>
          <div>
            <ThemeToggle />
          </div>
        </div>
      </div>

      <div className="mt-10 flex-1 px-5">
        <NavLinks />
      </div>
    </aside>
  );
}
