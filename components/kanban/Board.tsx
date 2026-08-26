"use client";

import { useCallback, useMemo, useState } from "react";
import { useTasks } from "@/lib/store-context";
import { useBoardDrag } from "@/lib/useBoardDrag";
import type { Project, ProjectStage, StageKind } from "@/lib/types";
import { STAGE_KINDS } from "@/lib/types";
import Column from "./Column";
import RemoveStageDialog from "./RemoveStageDialog";
import { inputClass, labelClass, selectClass } from "../ui/Field";

export default function Board({ project, todayISO }: { project: Project; todayISO: string }) {
  const { tasks, stagesFor, moveTask, addStage } = useTasks();
  const [removing, setRemoving] = useState<ProjectStage | null>(null);
  const [addingColumn, setAddingColumn] = useState(false);
  /** Announced politely after a move, whether it came from drag or keyboard. */
  const [announcement, setAnnouncement] = useState("");

  const stages = stagesFor(project.id);

  const byStage = useMemo(() => {
    const map = new Map<string, typeof tasks>();
    for (const stage of stages) map.set(stage.id, []);
    for (const task of tasks) {
      if (task.status === "trashed" || task.projectId !== project.id || !task.stageId) continue;
      map.get(task.stageId)?.push(task);
    }
    for (const list of map.values()) list.sort((a, b) => a.boardOrder - b.boardOrder);
    return map;
  }, [tasks, stages, project.id]);

  const announceMove = useCallback(
    (taskId: string, stageId: string) => {
      const task = tasks.find((t) => t.id === taskId);
      const stage = stages.find((s) => s.id === stageId);
      if (task && stage) setAnnouncement(`${task.title} moved to ${stage.name}.`);
    },
    [tasks, stages],
  );

  const onMove = useCallback(
    (taskId: string, stageId: string, index: number) => {
      moveTask(taskId, stageId, index);
      announceMove(taskId, stageId);
    },
    [moveTask, announceMove],
  );

  const { dragTaskId, target, cardProps, columnProps } = useBoardDrag(onMove);

  return (
    <>
      {/*
        Bleed is calibrated to PageShell's workspace padding so the board's own
        overflow-x-auto is the only horizontal scroller — if PageShell's px-*
        steps change, update these to match or the page gains a spurious
        second horizontal scrollbar (visible overflow-x next to
        shell:overflow-y-auto computes to `overflow: auto` on the ancestor).
      */}
      <div className="-mx-6 overflow-x-auto px-6 pb-4 sm:-mx-10 sm:px-10 shell:-mx-8 shell:px-8 xl:-mx-10 xl:px-10">
        <div className="flex items-start gap-3">
          {stages.map((stage) => (
            <Column
              key={stage.id}
              stage={stage}
              stages={stages}
              tasks={byStage.get(stage.id) ?? []}
              todayISO={todayISO}
              projectId={project.id}
              dragTaskId={dragTaskId}
              dropIndex={target?.stageId === stage.id ? target.index : null}
              cardProps={cardProps}
              columnProps={columnProps}
              onMove={onMove}
              onRemove={() => setRemoving(stage)}
            />
          ))}

          {addingColumn ? (
            <AddColumn
              onCancel={() => setAddingColumn(false)}
              onAdd={async (name, kind) => {
                await addStage(project.id, { name, kind });
                setAddingColumn(false);
                setAnnouncement(`${name} column added.`);
              }}
            />
          ) : (
            <button
              onClick={() => setAddingColumn(true)}
              className="w-44 shrink-0 rounded-2xl border border-dashed border-border px-3 py-3 text-left font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground hover:border-accent/40 hover:text-foreground"
            >
              + Add column
            </button>
          )}
        </div>
      </div>

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {removing && (
        <RemoveStageDialog
          stage={removing}
          siblings={stages.filter((s) => s.id !== removing.id)}
          taskCount={(byStage.get(removing.id) ?? []).length}
          onClose={() => setRemoving(null)}
          onRemoved={setAnnouncement}
        />
      )}
    </>
  );
}

function AddColumn({
  onAdd,
  onCancel,
}: {
  onAdd: (name: string, kind: StageKind) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<StageKind>("active");

  return (
    <div className="w-56 shrink-0 space-y-2 rounded-2xl border border-border bg-card p-3">
      <div className="space-y-1">
        <label htmlFor="new-column-name" className={labelClass}>
          Column name
        </label>
        <input
          id="new-column-name"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim()) onAdd(name.trim(), kind);
            if (e.key === "Escape") onCancel();
          }}
          className={inputClass}
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="new-column-kind" className={labelClass}>
          Behaves as
        </label>
        <select
          id="new-column-kind"
          value={kind}
          onChange={(e) => setKind(e.target.value as StageKind)}
          className={selectClass}
        >
          {/* A second done column is refused by the server, so it isn't offered. */}
          {STAGE_KINDS.filter((k) => k !== "done").map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <button
          disabled={!name.trim()}
          onClick={() => onAdd(name.trim(), kind)}
          className="rounded-lg bg-muted px-3 py-1.5 text-sm font-medium hover:bg-border disabled:opacity-40"
        >
          Add
        </button>
        <button
          onClick={onCancel}
          className="rounded-lg px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
