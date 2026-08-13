"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTasks } from "@/lib/store-context";
import { PROJECT_COLORS, type Project } from "@/lib/types";
import SidePanel from "./ui/SidePanel";
import { Field, SavingInput } from "./ui/Field";
import { labelClass } from "./ui/Field";

/**
 * Reached from an explicit Settings action in the project header, rather than
 * by discovering that the title happens to be clickable.
 */
export default function ProjectSettings({
  project,
  onClose,
}: {
  project: Project;
  onClose: () => void;
}) {
  const router = useRouter();
  const { tasks, updateProject, deleteProject } = useTasks();
  const [confirming, setConfirming] = useState(false);

  const affected = tasks.filter((t) => t.projectId === project.id).length;

  return (
    <SidePanel open onClose={onClose} title="Project settings">
      <div className="space-y-5">
        <SavingInput
          id="project-name"
          label="Name"
          value={project.name}
          onSave={(name) => name.trim() && updateProject(project.id, { name: name.trim() })}
        />

        <Field label="Colour">
          <div className="flex flex-wrap items-center gap-2">
            {PROJECT_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => updateProject(project.id, { color: c })}
                aria-label={`Use colour ${c}`}
                aria-pressed={project.color === c}
                className="flex size-11 items-center justify-center rounded-full sm:size-8"
              >
                <span
                  className="size-5 rounded-full"
                  style={{
                    background: c,
                    boxShadow: project.color === c ? `0 0 0 2px var(--color-background), 0 0 0 4px ${c}` : undefined,
                  }}
                />
                {/* Colour alone never carries the choice. */}
                {project.color === c && <span className="sr-only">Selected</span>}
              </button>
            ))}
          </div>
        </Field>

        <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
          <div>
            <p className="text-sm font-medium">Archived</p>
            <p className="text-xs text-muted-foreground">
              Hides the project from the sidebar. Its tasks stay where they are.
            </p>
          </div>
          <button
            role="switch"
            aria-checked={project.archived}
            aria-label="Archived"
            onClick={() => updateProject(project.id, { archived: !project.archived })}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
              project.archived ? "bg-accent" : "bg-border"
            }`}
          >
            <span
              className={`absolute top-0.5 size-5 rounded-full bg-card transition-all ${
                project.archived ? "left-[22px]" : "left-0.5"
              }`}
            />
          </button>
        </div>

        <section className="space-y-2 rounded-xl border border-dashed border-border px-4 py-4">
          <h3 className={labelClass}>Delete permanently</h3>
          <p className="text-xs text-muted-foreground">
            {affected === 0
              ? "This project has no tasks."
              : `${affected} ${affected === 1 ? "task keeps" : "tasks keep"} existing, but ${
                  affected === 1 ? "it moves" : "they move"
                } to no project and lose their column.`}
          </p>
          {confirming ? (
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={async () => {
                  await deleteProject(project.id);
                  onClose();
                  router.push("/all");
                }}
                className="rounded-lg bg-muted px-3 py-2 text-sm font-medium hover:bg-border"
              >
                Yes, delete {project.name}
              </button>
              <button
                onClick={() => setConfirming(false)}
                className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              className="pt-1 text-sm text-muted-foreground hover:text-foreground"
            >
              Delete this project
            </button>
          )}
        </section>
      </div>
    </SidePanel>
  );
}
