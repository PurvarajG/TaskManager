"use client";

import {
  useCallback,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { daysBetween } from "./parse";
import { shiftDays } from "./summary";
import type { TaskInput } from "./types";

export type TimelineDragMode = "move" | "resize-start" | "resize-end";

/** The bits of a task the pure drag maths needs — nothing DOM- or store-shaped. */
export type DragTaskSnapshot = {
  scheduled: string;
  isComplex: boolean;
  finishDate?: string;
};

export type TimelineDragPatch = Partial<Pick<TaskInput, "scheduled" | "isComplex" | "finishDate">>;

export type TimelineDragResult = {
  /** What the bar should render while the pointer is down, real dates (not clamped to the visible window). */
  preview: { scheduled: string; finishDate?: string };
  /** The patch to send on release, or null when the gesture is a no-op and nothing should be sent. */
  patch: TimelineDragPatch | null;
};

/**
 * Pure index→patch mapping for one drag gesture, kept free of pointer/DOM
 * concerns so it is unit-testable without simulating pointer events.
 *
 * `resolveComplex` on the server (lib/store/tasks.ts) already clears
 * `dueTime` when a task becomes complex, clears `finishDate` when it stops
 * being complex, and rejects `finishDate < scheduled` — this function sends
 * simple patches and lets the server do that work, but it must never send a
 * patch the server would reject, since the client applies it optimistically.
 */
export function resolveTimelineDrag(
  mode: TimelineDragMode,
  task: DragTaskSnapshot,
  targetISO: string,
): TimelineDragResult {
  const endISO = task.isComplex && task.finishDate ? task.finishDate : task.scheduled;

  if (mode === "move") {
    if (targetISO === task.scheduled) {
      return { preview: { scheduled: task.scheduled, finishDate: task.finishDate }, patch: null };
    }
    const delta = daysBetween(task.scheduled, targetISO);
    const finishDate = task.isComplex && task.finishDate ? shiftDays(task.finishDate, delta) : undefined;
    return {
      preview: { scheduled: targetISO, finishDate },
      patch: { scheduled: targetISO, ...(finishDate ? { finishDate } : {}) },
    };
  }

  if (mode === "resize-end") {
    if (targetISO <= task.scheduled) {
      // Dragged the right edge back onto (or past) the start day: revert to a single-day task.
      return {
        preview: { scheduled: task.scheduled, finishDate: undefined },
        patch: task.isComplex ? { isComplex: false } : null,
      };
    }
    if (targetISO === endISO) {
      return { preview: { scheduled: task.scheduled, finishDate: task.finishDate }, patch: null };
    }
    return {
      preview: { scheduled: task.scheduled, finishDate: targetISO },
      patch: { isComplex: true, finishDate: targetISO },
    };
  }

  // resize-start: clamp to the end day and never send a patch that would put start after end.
  const clamped = targetISO > endISO ? endISO : targetISO;
  if (clamped === task.scheduled) {
    return { preview: { scheduled: task.scheduled, finishDate: task.finishDate }, patch: null };
  }
  return {
    preview: { scheduled: clamped, finishDate: task.finishDate },
    patch: targetISO > endISO ? null : { scheduled: clamped },
  };
}

/** Maps a pointer's clientX to a clamped day index inside a day-columns grid rect. */
export function dayIndexFromX(
  clientX: number,
  rect: { left: number; width: number },
  dayCount: number,
): number {
  if (dayCount <= 0 || rect.width <= 0) return 0;
  const ratio = (clientX - rect.left) / rect.width;
  return Math.min(dayCount - 1, Math.max(0, Math.floor(ratio * dayCount)));
}

const MOVE_THRESHOLD_PX = 4;

export type TimelinePreview = { taskId: string; mode: TimelineDragMode; dayIndex: number };

export type TimelineDragHandlers = {
  onPointerDown: (event: ReactPointerEvent) => void;
  onPointerMove: (event: ReactPointerEvent) => void;
  onPointerUp: (event: ReactPointerEvent) => void;
  onPointerCancel: (event: ReactPointerEvent) => void;
  style: CSSProperties;
};

type ActiveDrag = {
  taskId: string;
  mode: TimelineDragMode;
  pointerId: number;
  startX: number;
  startY: number;
  moved: boolean;
};

/**
 * Pointer-based (not HTML5-native) drag for the day-scale Today timeline.
 * One hook instance drives every bar and handle on the grid: `bind(taskId,
 * mode)` returns the pointer handlers for a given gesture, `preview` is the
 * live day index while a gesture is in flight, and `wrapClick` suppresses a
 * bar's onClick only when the pointer actually moved.
 */
export function useTimelineDrag({
  days,
  gridRef,
  onCommit,
}: {
  days: string[];
  gridRef: RefObject<HTMLElement | null>;
  onCommit: (drag: { taskId: string; mode: TimelineDragMode }, dayIndex: number) => void;
}) {
  const [preview, setPreview] = useState<TimelinePreview | null>(null);
  const dragRef = useRef<ActiveDrag | null>(null);
  const justDraggedRef = useRef(false);

  const dayIndexAt = useCallback(
    (clientX: number) => {
      const rect = gridRef.current?.getBoundingClientRect();
      if (!rect) return 0;
      return dayIndexFromX(clientX, rect, days.length);
    },
    [gridRef, days.length],
  );

  const bind = useCallback(
    (taskId: string, mode: TimelineDragMode): TimelineDragHandlers => ({
      onPointerDown: (event) => {
        event.stopPropagation();
        // A pointerId the browser doesn't recognize as active (e.g. an untrusted/synthetic
        // event) makes this throw; the drag must still start even if capture can't be set.
        try {
          (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
        } catch {
          // no-op: the gesture still works via ordinary event bubbling without capture.
        }
        dragRef.current = {
          taskId,
          mode,
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          moved: false,
        };
        setPreview({ taskId, mode, dayIndex: dayIndexAt(event.clientX) });
      },
      onPointerMove: (event) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        if (
          !drag.moved &&
          (Math.abs(event.clientX - drag.startX) > MOVE_THRESHOLD_PX ||
            Math.abs(event.clientY - drag.startY) > MOVE_THRESHOLD_PX)
        ) {
          drag.moved = true;
        }
        setPreview({ taskId: drag.taskId, mode: drag.mode, dayIndex: dayIndexAt(event.clientX) });
      },
      onPointerUp: (event) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        const dayIndex = dayIndexAt(event.clientX);
        dragRef.current = null;
        setPreview(null);
        if (drag.moved) {
          justDraggedRef.current = true;
          onCommit({ taskId: drag.taskId, mode: drag.mode }, dayIndex);
        }
      },
      onPointerCancel: (event) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        dragRef.current = null;
        setPreview(null);
      },
      style: { touchAction: "none" },
    }),
    [dayIndexAt, onCommit],
  );

  /** Wraps a bar's onClick so a drag gesture doesn't also pop the task panel open. */
  const wrapClick = useCallback(
    (onClick: () => void) => () => {
      if (justDraggedRef.current) {
        justDraggedRef.current = false;
        return;
      }
      onClick();
    },
    [],
  );

  return { preview, bind, wrapClick };
}
