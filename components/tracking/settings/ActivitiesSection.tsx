"use client";

import { useState } from "react";
import { useTasks } from "@/lib/store-context";
import type { Activity, Category } from "@/lib/types";
import { useDragReorder } from "@/lib/useDragReorder";
import CategoryDot from "../CategoryDot";

/** Add, rename, assign category, set typical duration, toggle preset — grouped by category. */
export default function ActivitiesSection() {
  const { categories } = useTasks();
  const visibleCategories = [...categories].filter((c) => !c.archived).sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="space-y-6">
      {visibleCategories.map((category) => (
        <ActivityGroup key={category.id} category={category} categories={categories} />
      ))}
    </div>
  );
}

function ActivityGroup({ category, categories }: { category: Category; categories: Category[] }) {
  const { activities, addActivity, patchActivity, deleteActivity, reorderActivities } = useTasks();
  const [name, setName] = useState("");
  const [typicalMinutes, setTypicalMinutes] = useState("");

  const ownActivities = activities
    .filter((a) => a.categoryId === category.id)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const { list, dragHandleProps } = useDragReorder(ownActivities, (ids) => reorderActivities(category.id, ids));

  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <CategoryDot color={category.color} />
        <h3 className="text-sm font-medium">{category.name}</h3>
      </div>

      <ul className="space-y-1.5">
        {list.map((activity) => (
          <ActivityRow
            key={activity.id}
            activity={activity}
            categories={categories}
            dragHandleProps={dragHandleProps(activity.id)}
            onPatch={(patch) => patchActivity(activity.id, patch)}
            onDelete={() => deleteActivity(activity.id)}
          />
        ))}
      </ul>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = name.trim();
          if (!trimmed) return;
          const minutes = Number(typicalMinutes);
          addActivity({
            categoryId: category.id,
            name: trimmed,
            typicalMinutes: minutes > 0 ? minutes : undefined,
          });
          setName("");
          setTypicalMinutes("");
        }}
        className="mt-2 flex flex-wrap items-center gap-2"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={`Add an activity in ${category.name}`}
          aria-label={`New activity name in ${category.name}`}
          className="min-w-0 flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-accent/40"
        />
        <input
          type="number"
          min={1}
          value={typicalMinutes}
          onChange={(e) => setTypicalMinutes(e.target.value)}
          placeholder="Typical min"
          aria-label={`Typical minutes for new activity in ${category.name}`}
          className="w-28 rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-accent/40"
        />
        <button
          type="submit"
          className="min-h-11 rounded-lg bg-muted px-3 py-2 text-sm font-medium hover:bg-border sm:min-h-9"
        >
          Add
        </button>
      </form>
    </section>
  );
}

function ActivityRow({
  activity,
  categories,
  dragHandleProps,
  onPatch,
  onDelete,
}: {
  activity: Activity;
  categories: Category[];
  dragHandleProps: React.HTMLAttributes<HTMLLIElement> & { draggable: boolean };
  onPatch: (patch: {
    name?: string;
    categoryId?: string;
    typicalMinutes?: number;
    isPreset?: boolean;
    pinned?: boolean;
    archived?: boolean;
  }) => void;
  onDelete: () => void;
}) {
  return (
    <li
      {...dragHandleProps}
      className={`flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 ${
        activity.archived ? "opacity-50" : ""
      }`}
    >
      <span aria-hidden className="cursor-grab text-muted-foreground">
        ⠿
      </span>

      <input
        value={activity.name}
        aria-label={`Rename ${activity.name}`}
        onChange={(e) => onPatch({ name: e.target.value })}
        className="min-w-0 flex-1 rounded-md bg-transparent px-1 py-1 text-sm outline-none focus:bg-muted"
      />

      <select
        value={activity.categoryId}
        aria-label={`Category for ${activity.name}`}
        onChange={(e) => onPatch({ categoryId: e.target.value })}
        className="rounded-md border border-border bg-card px-2 py-1 text-xs outline-none focus:border-accent/40"
      >
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      <input
        type="number"
        min={1}
        value={activity.typicalMinutes ?? ""}
        aria-label={`Typical minutes for ${activity.name}`}
        placeholder="min"
        onChange={(e) => {
          const n = Number(e.target.value);
          onPatch({ typicalMinutes: n > 0 ? n : 0 });
        }}
        className="w-16 rounded-md border border-border bg-card px-2 py-1 text-xs outline-none focus:border-accent/40"
      />

      <button
        role="switch"
        aria-checked={activity.isPreset}
        aria-label={activity.isPreset ? `Remove ${activity.name} from quick start` : `Add ${activity.name} to quick start`}
        onClick={() => onPatch({ isPreset: !activity.isPreset })}
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
          activity.isPreset ? "bg-accent" : "bg-border"
        }`}
        title="Quick-start preset"
      >
        <span
          className={`absolute top-0.5 size-4 rounded-full bg-card transition-all ${
            activity.isPreset ? "left-[18px]" : "left-0.5"
          }`}
        />
      </button>

      <button
        role="switch"
        aria-checked={activity.pinned}
        aria-label={activity.pinned ? `Unpin ${activity.name}` : `Pin ${activity.name}`}
        disabled={!activity.isPreset}
        onClick={() => onPatch({ pinned: !activity.pinned })}
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-40 ${
          activity.pinned ? "bg-accent" : "bg-border"
        }`}
        title="Pinned"
      >
        <span
          className={`absolute top-0.5 size-4 rounded-full bg-card transition-all ${
            activity.pinned ? "left-[18px]" : "left-0.5"
          }`}
        />
      </button>

      <button
        role="switch"
        aria-checked={activity.archived}
        aria-label={activity.archived ? `Unarchive ${activity.name}` : `Archive ${activity.name}`}
        onClick={() => onPatch({ archived: !activity.archived })}
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
          activity.archived ? "bg-accent" : "bg-border"
        }`}
      >
        <span
          className={`absolute top-0.5 size-4 rounded-full bg-card transition-all ${
            activity.archived ? "left-[18px]" : "left-0.5"
          }`}
        />
      </button>

      <button
        onClick={onDelete}
        aria-label={`Delete ${activity.name}`}
        className="shrink-0 px-1 text-muted-foreground hover:text-foreground"
      >
        ×
      </button>
    </li>
  );
}
