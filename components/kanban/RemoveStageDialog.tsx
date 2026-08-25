"use client";

import { useState } from "react";
import { useTasks } from "@/lib/store-context";
import type { ProjectStage } from "@/lib/types";
import { labelClass, selectClass } from "../ui/Field";

/**
 * Removing a column can't proceed until its tasks have somewhere to go. The
 * destination is a required choice, not a default that quietly loses work.
 */
export default function RemoveStageDialog({
  stage,
  siblings,
  taskCount,
  onClose,
  onRemoved,
}: {
  stage: ProjectStage;
  siblings: ProjectStage[];
  taskCount: number;
  onClose: () => void;
  onRemoved: (message: string) => void;
}) {
  const { removeStage } = useTasks();
  const [destination, setDestination] = useState("");
  const [busy, setBusy] = useState(false);

  const needsDestination = taskCount > 0;
  const canRemove = !needsDestination || destination !== "";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Remove the ${stage.name} column`}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
    >
      {/* Scrim stays a literal black overlay, not a token: it dims whatever is behind it
         (page content in light OR dark theme), so it must be theme-invariant rather than
         following --color-foreground/--color-background, which would invert its effect. */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden>
        {/* See components/ui/SidePanel.tsx for why this spacer exists. */}
        <div className="no-drag h-9" />
      </div>
      <div className="no-drag relative w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-xl">
        <h2 className="font-display text-lg">Remove &ldquo;{stage.name}&rdquo;</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {needsDestination
            ? `${taskCount} ${taskCount === 1 ? "task needs" : "tasks need"} a new column first.`
            : "This column is empty."}
        </p>

        {needsDestination && (
          <div className="mt-4 space-y-1.5">
            <label htmlFor="stage-destination" className={labelClass}>
              Move tasks to
            </label>
            <select
              id="stage-destination"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className={selectClass}
            >
              <option value="">Choose a column…</option>
              {siblings.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="mt-5 flex items-center gap-2">
          <button
            disabled={!canRemove || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await removeStage(stage.id, destination || siblings[0].id);
                onRemoved(`${stage.name} column removed.`);
                onClose();
              } catch {
                // The store has already surfaced the server's reason.
              } finally {
                setBusy(false);
              }
            }}
            className="min-h-11 rounded-lg bg-gradient-to-r from-accent to-accent-secondary px-3 py-2 text-sm font-medium text-accent-foreground transition-all hover:brightness-110 disabled:opacity-40 sm:min-h-9"
          >
            Remove column
          </button>
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
