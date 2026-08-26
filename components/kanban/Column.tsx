"use client";

import { useState } from "react";
import { useTasks } from "@/lib/store-context";
import type { ProjectStage, Task } from "@/lib/types";
import Card from "./Card";

export default function Column({
  stage,
  stages,
  tasks,
  todayISO,
  projectId,
  dragTaskId,
  dropIndex,
  cardProps,
  columnProps,
  onMove,
  onRemove,
  onCollapse,
}: {
  stage: ProjectStage;
  stages: ProjectStage[];
  tasks: Task[];
  todayISO: string;
  projectId: string;
  dragTaskId: string | null;
  dropIndex: number | null;
  cardProps: (taskId: string, stageId: string, index: number) => React.HTMLAttributes<HTMLElement> & {
    draggable: boolean;
  };
  columnProps: (stageId: string, count: number) => React.HTMLAttributes<HTMLElement>;
  onMove: (taskId: string, stageId: string, index: number) => void;
  onRemove: () => void;
  /** Only set for backlog-kind columns — collapses this column into the
   *  prototype's single-line CollapsedBar. */
  onCollapse?: () => void;
}) {
  const { addTask, renameStage } = useTasks();
  const [name, setName] = useState(stage.name);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  return (
    <section
      {...columnProps(stage.id, tasks.length)}
      aria-label={`${stage.name}, ${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}`}
      className="group/column flex w-72 shrink-0 flex-col rounded-xl bg-muted/50 p-3"
    >
      <header className="flex items-center gap-2 px-1 pb-2">
        <input
          value={name}
          aria-label={`Rename ${stage.name} column`}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            const next = name.trim();
            if (next && next !== stage.name) renameStage(stage.id, next);
            else setName(stage.name);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") {
              setName(stage.name);
              (e.target as HTMLInputElement).blur();
            }
          }}
          className="min-w-0 flex-1 rounded-md bg-transparent px-1 py-0.5 font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground outline-none hover:bg-muted focus:bg-card focus:text-foreground"
        />
        <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{tasks.length}</span>
        {onCollapse && (
          <button
            onClick={onCollapse}
            aria-label={`Collapse ${stage.name} column`}
            className="shrink-0 rounded-md px-1.5 py-0.5 text-muted-foreground opacity-0 hover:bg-border hover:text-foreground focus:opacity-100 group-hover/column:opacity-100"
          >
            ‹›
          </button>
        )}
        <button
          onClick={onRemove}
          aria-label={`Remove ${stage.name} column`}
          className="shrink-0 rounded-md px-1.5 py-0.5 text-muted-foreground opacity-0 hover:bg-border hover:text-foreground focus:opacity-100 group-hover/column:opacity-100"
        >
          ×
        </button>
      </header>

      <ul className="flex min-h-16 flex-1 flex-col gap-2">
        {tasks.map((task, index) => (
          <div key={task.id} className="contents">
            {dropIndex === index && <DropLine />}
            <Card
              task={task}
              stages={stages}
              todayISO={todayISO}
              dragging={dragTaskId === task.id}
              dragProps={cardProps(task.id, stage.id, index)}
              onMoveToStage={(stageId) => onMove(task.id, stageId, 0)}
            />
          </div>
        ))}
        {dropIndex === tasks.length && <DropLine />}

        {tasks.length === 0 && dropIndex === null && (
          <p className="px-1 py-3 text-xs text-muted-foreground">Nothing here yet.</p>
        )}
      </ul>

      {adding ? (
        <input
          autoFocus
          value={draft}
          aria-label={`Add a task to ${stage.name}`}
          placeholder="What needs doing?"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            setAdding(false);
            setDraft("");
          }}
          onKeyDown={async (e) => {
            if (e.key === "Escape") (e.target as HTMLInputElement).blur();
            if (e.key !== "Enter" || !draft.trim()) return;
            const text = draft;
            setDraft("");
            await addTask(text, { projectId, stageId: stage.id }).catch(() => {});
          }}
          className="mt-2 h-9 w-full rounded-lg border border-border bg-card px-2.5 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-accent/40"
        />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="mt-2 rounded-lg px-2 py-2 text-left font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          + Add task
        </button>
      )}
    </section>
  );
}

function DropLine() {
  return <li aria-hidden className="h-0.5 rounded-full bg-accent" />;
}
