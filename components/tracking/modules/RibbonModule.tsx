"use client";

import { useState } from "react";
import { useTasks } from "@/lib/store-context";
import { dayWindow } from "@/lib/tracking-day";
import type { Gap, Segment } from "@/lib/types";
import CategoryPicker from "../CategoryPicker";
import GapBlock from "../GapBlock";
import GapFillForm from "../GapFillForm";
import MetaLabel from "../MetaLabel";
import { segmentLabel } from "../segment-label";
import TimeBlock from "../TimeBlock";

const PX_PER_HOUR = 40;
const TOTAL_HEIGHT = PX_PER_HOUR * 24;

function minutesFromStart(iso: string, dayStart: Date): number {
  return (new Date(iso).getTime() - dayStart.getTime()) / 60_000;
}

/**
 * The vertical continuous day. Reuses DashboardTimeline's geometry approach
 * (percentage offsets, repeating gridlines) rotated to vertical — an hour
 * rail on the left, blocks proportional to duration, absence rendered dashed
 * rather than left blank so it can't be mistaken for "nothing happened here".
 */
export default function RibbonModule({ dayISO, isToday }: { dayISO: string; isToday: boolean }) {
  const { segments, gaps, categories, activities, tasks, settings, deleteSegment, patchSegment } = useTasks();
  const [selected, setSelected] = useState<{ kind: "segment"; segment: Segment } | { kind: "gap"; gap: Gap } | null>(
    null,
  );

  if (!settings) return null;
  const { start: dayStart, end: dayEnd } = dayWindow(dayISO, settings);
  const now = new Date();
  const nowOffset = isToday ? (minutesFromStart(now.toISOString(), dayStart) / 1440) * TOTAL_HEIGHT : null;

  const hours = Array.from({ length: 24 }, (_, i) => (settings.dayStartHour + i) % 24);

  return (
    <div className="space-y-3">
      <div className="flex">
        <div className="relative w-10 shrink-0 sm:w-12">
          {hours.map((hour, i) => (
            <div key={i} className="absolute -translate-y-1/2" style={{ top: (i / 24) * TOTAL_HEIGHT }}>
              <MetaLabel>{String(hour).padStart(2, "0")}:00</MetaLabel>
            </div>
          ))}
        </div>

        <div
          className="relative min-w-0 flex-1 rounded-lg border border-border/70"
          style={{
            height: TOTAL_HEIGHT,
            backgroundImage:
              "repeating-linear-gradient(to bottom, transparent 0, transparent calc(4.1666% - 1px), color-mix(in srgb, var(--color-border) 55%, transparent) calc(4.1666% - 1px), color-mix(in srgb, var(--color-border) 55%, transparent) 4.1666%)",
          }}
        >
          {segments.map((segment) => {
            const top = Math.max(0, (minutesFromStart(segment.startedAt, dayStart) / 1440) * TOTAL_HEIGHT);
            const endISO = segment.endedAt ?? (isToday ? now.toISOString() : dayEnd.toISOString());
            const bottom = Math.min(
              TOTAL_HEIGHT,
              (minutesFromStart(endISO, dayStart) / 1440) * TOTAL_HEIGHT,
            );
            if (bottom <= 0 || top >= TOTAL_HEIGHT || bottom <= top) return null;
            const category = categories.find((c) => c.id === segment.categoryId);
            return (
              <TimeBlock
                key={segment.id}
                color={category?.color ?? "cat-neutral"}
                label={segmentLabel(segment, categories, activities, tasks)}
                density="continuous"
                onClick={() => setSelected({ kind: "segment", segment })}
                style={{ position: "absolute", top, height: Math.max(bottom - top, 4), left: 0, right: 0 }}
              />
            );
          })}

          {gaps.map((gap) => {
            const top = (minutesFromStart(gap.startedAt, dayStart) / 1440) * TOTAL_HEIGHT;
            const bottom = (minutesFromStart(gap.endedAt, dayStart) / 1440) * TOTAL_HEIGHT;
            return (
              <GapBlock
                key={`${gap.startedAt}-${gap.endedAt}`}
                label={`${gap.minutes}m untracked`}
                onClick={() => setSelected({ kind: "gap", gap })}
                style={{ position: "absolute", top, height: Math.max(bottom - top, 4), left: 0, right: 0 }}
              />
            );
          })}

          {nowOffset !== null && nowOffset >= 0 && nowOffset <= TOTAL_HEIGHT && (
            <div
              aria-label="Now"
              className="pointer-events-none absolute inset-x-0 z-10 h-px bg-accent"
              style={{ top: nowOffset }}
            />
          )}
        </div>
      </div>

      {selected && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
          {selected.kind === "gap" ? (
            <GapFillForm gap={selected.gap} onFilled={() => setSelected(null)} />
          ) : (
            <SegmentEditor
              segment={selected.segment}
              onSave={(patch) => {
                patchSegment(selected.segment.id, patch);
                setSelected(null);
              }}
              onDelete={() => {
                deleteSegment(selected.segment.id);
                setSelected(null);
              }}
              onCancel={() => setSelected(null)}
            />
          )}
        </div>
      )}
    </div>
  );
}

function SegmentEditor({
  segment,
  onSave,
  onDelete,
  onCancel,
}: {
  segment: Segment;
  onSave: (patch: { categoryId?: string; note?: string }) => void;
  onDelete: () => void;
  onCancel: () => void;
}) {
  const { categories } = useTasks();
  const [categoryId, setCategoryId] = useState(segment.categoryId);
  const [note, setNote] = useState(segment.note ?? "");

  return (
    <>
      <CategoryPicker categories={categories} value={categoryId} onChange={setCategoryId} />
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note (optional)"
        className="min-w-0 flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-accent/40"
      />
      <button
        onClick={() => onSave({ categoryId, note })}
        className="min-h-11 shrink-0 rounded-lg bg-gradient-to-r from-accent to-accent-secondary px-3 py-2 text-sm font-medium text-accent-foreground hover:brightness-110 sm:min-h-9"
      >
        Save
      </button>
      <button
        onClick={onDelete}
        className="min-h-11 shrink-0 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground sm:min-h-9"
      >
        Delete
      </button>
      <button
        onClick={onCancel}
        className="min-h-11 shrink-0 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground sm:min-h-9"
      >
        Cancel
      </button>
    </>
  );
}
