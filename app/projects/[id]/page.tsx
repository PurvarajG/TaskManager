"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useTasks } from "@/lib/store-context";
import { toISODate } from "@/lib/parse";
import { fmt, PRIORITY_LABEL } from "@/lib/format";
import { projectSummary } from "@/lib/summary";
import { projectColorVar } from "@/lib/types";
import { getAttentionItems, getFocusTask } from "@/lib/focus";
import PageShell from "@/components/ui/PageShell";
import MetricStrip from "@/components/ui/MetricStrip";
import FocusCard from "@/components/ui/FocusCard";
import AttentionPanel from "@/components/ui/AttentionPanel";
import SectionLabel from "@/components/SectionLabel";
import ProjectSettings from "@/components/ProjectSettings";
import Board from "@/components/kanban/Board";

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const { tasks, projects, stages, timeEntries, running, startTimer, stopTimer, completeTask, ready } =
    useTasks();
  const todayISO = toISODate(new Date());
  const [settingsOpen, setSettingsOpen] = useState(false);

  const project = projects.find((p) => p.id === id);

  const summary = useMemo(
    () => projectSummary(id, tasks, stages, timeEntries, todayISO),
    [id, tasks, stages, timeEntries, todayISO],
  );

  const focusTask = useMemo(
    () => getFocusTask(tasks, id, running, todayISO),
    [tasks, id, running, todayISO],
  );

  const attentionItems = useMemo(
    () => getAttentionItems(tasks, stages, id, todayISO),
    [tasks, stages, id, todayISO],
  );

  if (ready && !project) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16 text-center text-sm text-muted-foreground">
        Project not found.
      </div>
    );
  }
  if (!project) return null;

  return (
    <PageShell
      label="Project"
      maxWidth="max-w-6xl shell:max-w-none"
      actions={
        <button
          onClick={() => setSettingsOpen(true)}
          className="rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          Settings
        </button>
      }
      title={
        <span className="flex items-center gap-3">
          <span className="size-3 shrink-0 rounded-full" style={{ background: projectColorVar(project.color) }} />
          <span className="select-text">{project.name}</span>
        </span>
      }
      headerExtra={
        <>
          {/* Plain counts, not a score: every figure here is recomputed from tasks,
              stage semantics, and time entries. */}
          <MetricStrip
            className="mt-5"
            items={[
              { key: "complete", value: `${summary.percentComplete}%`, label: "Complete" },
              { key: "open", value: String(summary.open), label: "Open" },
              { key: "done", value: String(summary.completed), label: "Done" },
              ...(summary.overdue > 0
                ? [{ key: "overdue", value: String(summary.overdue), label: "Overdue" }]
                : []),
              ...(summary.blocked > 0
                ? [{ key: "blocked", value: String(summary.blocked), label: "Blocked" }]
                : []),
              { key: "estimated", value: fmt(summary.estimatedMinutes), label: "Estimated" },
              { key: "recorded", value: fmt(summary.recordedMinutes), label: "Recorded" },
              { key: "today", value: fmt(summary.recordedTodayMinutes), label: "Today" },
              { key: "last-7-days", value: fmt(summary.recordedWeekMinutes), label: "Last 7 days" },
            ]}
          />

          {/* Counts by column, so the board's shape is legible before you scan it. */}
          <MetricStrip
            className="mt-2"
            items={summary.byStage.map(({ stage, count }) => ({
              key: stage.id,
              value: String(count),
              label: stage.name,
            }))}
          />
        </>
      }
    >
      {/* Below `shell:` this is ordinary document flow, same as every other
          page. From `shell:` up, PageShell already hands this children pane
          the shell's remaining height inside its own scrolling region — this
          wrapper turns that into a column where the focus band and section
          heads stay put (shrink-0) and only the board's row stretches to
          fill and scrolls internally, so the whole workspace fits one
          viewport per the prototype's grid-template-rows model, without
          touching PageShell's own shell:/rail: arithmetic. */}
      <div className="mt-8 shell:mt-3 shell:flex shell:h-full shell:min-h-0 shell:flex-col">
        {(focusTask || attentionItems.length > 0) && (
          <section className="shell:shrink-0">
            <SectionLabel>Do next</SectionLabel>
            <div className="mt-5 grid grid-cols-1 gap-3.5 shell:mt-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(270px,0.7fr)]">
              {focusTask ? (
                <FocusCard
                  surface="ink"
                  density="compact"
                  tag={running?.taskId === focusTask.id ? "Timing now" : "Current focus"}
                  title={focusTask.title}
                  meta={[
                    fmt(focusTask.minutes),
                    ...(focusTask.priority > 0 ? [PRIORITY_LABEL[focusTask.priority]] : []),
                  ]}
                  primaryLabel={
                    running?.taskId === focusTask.id ? "Stop timing" : `Start ${fmt(focusTask.minutes)}`
                  }
                  onPrimary={() =>
                    running?.taskId === focusTask.id ? stopTimer() : startTimer(focusTask.id)
                  }
                  secondaryLabel="Mark done"
                  onSecondary={() => completeTask(focusTask.id)}
                />
              ) : (
                <div className="flex min-h-36 flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
                  {/* FocusCard renders an h2 for its title when there is a focus
                      task; when there isn't, this empty state still needs an h2
                      here so AttentionPanel's h3 (rendered alongside it below)
                      isn't the first heading after PageShell's h1 — skipping a
                      level. */}
                  <h2 className="font-display text-base font-bold text-foreground">No current focus</h2>
                  <p>Nothing due, overdue, or running right now.</p>
                </div>
              )}

              <AttentionPanel items={attentionItems} />
            </div>
          </section>
        )}

        <div className="mt-10 flex items-center justify-between shell:mt-4 shell:shrink-0">
          <SectionLabel>Active work</SectionLabel>
        </div>

        {/* shell:overflow-x-hidden alongside shell:overflow-y-auto is deliberate:
            overflow-y:auto alone computes overflow-x to auto too (the box's
            scroll axes can't be split otherwise), which would give this
            wrapper its own horizontal scrollbar in addition to Board's own
            `-mx-*`/overflow-x-auto bleed div below. Pinning x to hidden here
            keeps Board's bleed the single horizontal scroller. */}
        <div className="mt-5 shell:mt-3 shell:min-h-0 shell:flex-1 shell:overflow-y-auto shell:overflow-x-hidden">
          <Board project={project} todayISO={todayISO} />
        </div>
      </div>

      {settingsOpen && (
        <ProjectSettings project={project} onClose={() => setSettingsOpen(false)} />
      )}
    </PageShell>
  );
}
