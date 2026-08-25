"use client";

import { useState } from "react";
import { useTasks } from "@/lib/store-context";
import { dayWindow } from "@/lib/tracking-day";
import type { Gap, Segment, TrackingSettings } from "@/lib/types";
import HourGrid from "../../time/HourGrid";
import CategoryPicker from "../CategoryPicker";
import GapBlock from "../GapBlock";
import GapFillForm from "../GapFillForm";
import MetaLabel from "../MetaLabel";
import { segmentSubject } from "../segment-label";
import TaskPicker from "../TaskPicker";
import TimeBlock from "../TimeBlock";

const PX_PER_HOUR = 32;
const MAX_RIBBON_PX = 560; // scroll inside the card past this, never grow the page

function minutesFromStart(iso: string, dayStart: Date): number {
  return (new Date(iso).getTime() - dayStart.getTime()) / 60_000;
}

/** windowStartHour/windowHours/windowStart/height for either the cropped
 * (waking-hours) or full (24h) ribbon window, anchored off the tracking day's
 * own start. */
function ribbonWindow(kind: "full" | "cropped", settings: TrackingSettings, dayStart: Date) {
  const windowStartHour = kind === "full" ? settings.dayStartHour : settings.wakingStartHour;
  const windowHours =
    kind === "full" ? 24 : (settings.wakingEndHour - settings.wakingStartHour + 24) % 24 || 24;
  const windowStart = new Date(
    dayStart.getTime() + ((windowStartHour - settings.dayStartHour + 24) % 24) * 60 * 60_000,
  );
  return { windowStartHour, windowHours, windowStart, height: windowHours * PX_PER_HOUR };
}

function formatMinutes(total: number): string {
  const m = Math.round(total);
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}

const pad = (h: number) => String(h).padStart(2, "0");

/**
 * The vertical continuous day. Reuses DashboardTimeline's geometry approach
 * (percentage offsets, repeating gridlines) rotated to vertical — an hour
 * rail on the left, blocks proportional to duration, absence rendered dashed
 * rather than left blank so it can't be mistaken for "nothing happened here".
 * Crops to the waking window by default; a toggle expands to the full day,
 * scrolling inside the card rather than growing the page.
 */
export default function RibbonModule({ dayISO, isToday }: { dayISO: string; isToday: boolean }) {
  const { segments, gaps, categories, activities, tasks, projects, settings, deleteSegment, patchSegment } =
    useTasks();
  const [selected, setSelected] = useState<{ kind: "segment"; segment: Segment } | { kind: "gap"; gap: Gap } | null>(
    null,
  );
  const dayStart = settings ? dayWindow(dayISO, settings).start : null;

  // Auto-expand when a segment is currently running and started outside the
  // cropped window — otherwise a night-shift day opens looking empty.
  const [full, setFull] = useState(() => {
    if (!settings || !dayStart) return false;
    const running = segments.find((s) => !s.endedAt);
    if (!running) return false;
    const cropped = ribbonWindow("cropped", settings, dayStart);
    const startMin = minutesFromStart(running.startedAt, cropped.windowStart);
    return startMin < 0 || startMin >= cropped.windowHours * 60;
  });

  if (!settings || !dayStart) return null;
  const { end: dayEnd } = dayWindow(dayISO, settings);
  const now = new Date();

  const cropped = ribbonWindow("cropped", settings, dayStart);
  const { windowStartHour, windowHours, windowStart, height } = full
    ? ribbonWindow("full", settings, dayStart)
    : cropped;
  const y = (iso: string) => (minutesFromStart(iso, windowStart) / (windowHours * 60)) * height;

  const nowOffset = isToday ? y(now.toISOString()) : null;

  // Minutes hidden by the crop — always measured against the cropped window,
  // regardless of which mode is currently rendered.
  const isOutsideCropped = (startISO: string, endISO: string) => {
    const top = minutesFromStart(startISO, cropped.windowStart);
    const bottom = minutesFromStart(endISO, cropped.windowStart);
    return bottom <= 0 || top >= cropped.windowHours * 60;
  };
  let outsideMinutes = 0;
  for (const segment of segments) {
    const endISO = segment.endedAt ?? (isToday ? now.toISOString() : dayEnd.toISOString());
    if (isOutsideCropped(segment.startedAt, endISO)) {
      outsideMinutes += (new Date(endISO).getTime() - new Date(segment.startedAt).getTime()) / 60_000;
    }
  }
  for (const gap of gaps) {
    if (isOutsideCropped(gap.startedAt, gap.endedAt)) outsideMinutes += gap.minutes;
  }

  return (
    <div className="space-y-3">
      <div className="overflow-y-auto" style={{ maxHeight: MAX_RIBBON_PX }}>
        <HourGrid windowStartHour={windowStartHour} windowHours={windowHours} height={height} nowOffset={nowOffset}>
          {segments.map((segment) => {
            const top = Math.max(0, y(segment.startedAt));
            const endISO = segment.endedAt ?? (isToday ? now.toISOString() : dayEnd.toISOString());
            const bottom = Math.min(height, y(endISO));
            if (bottom <= 0 || top >= height || bottom <= top) return null;
            const category = categories.find((c) => c.id === segment.categoryId);
            const subject = segmentSubject(segment, categories, activities, tasks, projects);
            return (
              <TimeBlock
                key={segment.id}
                color={category?.color ?? "cat-neutral"}
                label={subject.label}
                projectColor={subject.project?.color}
                density="continuous"
                onClick={() => setSelected({ kind: "segment", segment })}
                style={{ position: "absolute", top, height: Math.max(bottom - top, 4), left: 0, right: 0 }}
              />
            );
          })}

          {gaps.map((gap) => {
            const top = Math.max(0, y(gap.startedAt));
            const bottom = Math.min(height, y(gap.endedAt));
            if (bottom <= 0 || top >= height || bottom <= top) return null;
            return (
              <GapBlock
                key={`${gap.startedAt}-${gap.endedAt}`}
                label={`${gap.minutes}m untracked`}
                onClick={() => setSelected({ kind: "gap", gap })}
                style={{ position: "absolute", top, height: Math.max(bottom - top, 4), left: 0, right: 0 }}
              />
            );
          })}
        </HourGrid>
      </div>

      {(full || outsideMinutes > 0) && (
        <button type="button" onClick={() => setFull((v) => !v)} className="block">
          <MetaLabel>
            {full
              ? "⌃ show waking hours only"
              : `⌃ ${formatMinutes(outsideMinutes)} outside ${pad(settings.wakingStartHour)}:00–${pad(settings.wakingEndHour)}:00 — show full day`}
          </MetaLabel>
        </button>
      )}

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
  onSave: (patch: { categoryId?: string; note?: string; taskId?: string; activityId?: string }) => void;
  onDelete: () => void;
  onCancel: () => void;
}) {
  const { categories, tasks, projects } = useTasks();
  const [categoryId, setCategoryId] = useState(segment.categoryId);
  const [note, setNote] = useState(segment.note ?? "");
  const [taskId, setTaskId] = useState(segment.taskId ?? "");

  return (
    <>
      <CategoryPicker categories={categories} value={categoryId} onChange={setCategoryId} />
      <TaskPicker tasks={tasks} projects={projects} value={taskId || undefined} onChange={setTaskId} clearable />
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note (optional)"
        className="min-w-0 flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-accent/40"
      />
      <button
        onClick={() =>
          onSave({
            categoryId,
            note,
            ...(taskId !== (segment.taskId ?? "") ? { taskId, activityId: taskId ? "" : undefined } : {}),
          })
        }
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
