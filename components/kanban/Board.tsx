"use client";

import { useCallback, useMemo, useState } from "react";
import { useTasks } from "@/lib/store-context";
import { useBoardDrag } from "@/lib/useBoardDrag";
import type { Project, ProjectStage, StageKind } from "@/lib/types";
import { STAGE_KINDS } from "@/lib/types";
import Column from "./Column";
import RemoveStageDialog from "./RemoveStageDialog";
import CollapsedBar from "../ui/CollapsedBar";
import { inputClass, labelClass, selectClass } from "../ui/Field";

export default function Board({ project, todayISO }: { project: Project; todayISO: string }) {
  const { tasks, stagesFor, moveTask, addStage, settings, patchSettings } = useTasks();
  const [removing, setRemoving] = useState<ProjectStage | null>(null);
  const [addingColumn, setAddingColumn] = useState(false);
  /** Announced politely after a move, whether it came from drag or keyboard. */
  const [announcement, setAnnouncement] = useState("");

  const stages = stagesFor(project.id);

  // Reuses the same collapsedModules/patchSettings path Today's rail panels
  // already persist through, rather than a second collapse mechanism. Keyed
  // per stage so multiple backlog-kind columns (rare, but not disallowed)
  // collapse independently. Nothing is collapsed by default, so a board with
  // no saved preference renders exactly as it always has.
  const collapsedModules = settings?.collapsedModules ?? [];
  const collapseKey = (stageId: string) => `board-backlog-${stageId}`;
  const isCollapsed = (stageId: string) => collapsedModules.includes(collapseKey(stageId));
  const toggleCollapsed = (stageId: string) => {
    if (!settings) return;
    const key = collapseKey(stageId);
    patchSettings({
      collapsedModules: collapsedModules.includes(key)
        ? collapsedModules.filter((k) => k !== key)
        : [...collapsedModules, key],
    });
  };

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
        Bleed is calibrated to PageShell's workspace padding so this div's own
        overflow-x-auto is the only horizontal scroller — if PageShell's px-*
        steps change, update these to match. The immediate containing block at
        `shell:` and up (app/projects/[id]/page.tsx's Board wrapper) pins
        `shell:overflow-x-hidden` alongside its own `shell:overflow-y-auto`
        for exactly this reason: overflow-y:auto alone computes overflow-x to
        auto too, which would otherwise give that wrapper a second horizontal
        scrollbar around this one.
      */}
      <div className="-mx-6 overflow-x-auto px-6 pb-4 sm:-mx-10 sm:px-10 shell:-mx-8 shell:px-8 xl:-mx-10 xl:px-10">
        <div className="flex items-start gap-3">
          {stages.map((stage) => {
            const stageTasks = byStage.get(stage.id) ?? [];
            const collapsible = stage.kind === "backlog";

            if (collapsible && isCollapsed(stage.id)) {
              return (
                <div key={stage.id} className="w-56 shrink-0 self-end">
                  <CollapsedBar
                    label={stage.name}
                    count={stageTasks.length}
                    onExpand={() => toggleCollapsed(stage.id)}
                    dropProps={columnProps(stage.id, stageTasks.length)}
                  />
                </div>
              );
            }

            return (
              <Column
                key={stage.id}
                stage={stage}
                stages={stages}
                tasks={stageTasks}
                todayISO={todayISO}
                projectId={project.id}
                dragTaskId={dragTaskId}
                dropIndex={target?.stageId === stage.id ? target.index : null}
                cardProps={cardProps}
                columnProps={columnProps}
                onMove={onMove}
                onRemove={() => setRemoving(stage)}
                onCollapse={collapsible ? () => toggleCollapsed(stage.id) : undefined}
              />
            );
          })}

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
