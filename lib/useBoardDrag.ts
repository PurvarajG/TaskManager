"use client";

import { useCallback, useState } from "react";

export type DropTarget = { stageId: string; index: number };

/**
 * Native HTML5 drag for the board — no dependency, same approach as the list
 * reorder hook. Only the drop *intent* is tracked here; the store owns the
 * optimistic move and its rollback.
 *
 * Dragging is never the only way to move a card: every card menu offers the
 * same move as a button, and both paths announce the result.
 */
export function useBoardDrag(onMove: (taskId: string, stageId: string, index: number) => void) {
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [target, setTarget] = useState<DropTarget | null>(null);

  const reset = useCallback(() => {
    setDragTaskId(null);
    setTarget(null);
  }, []);

  const cardProps = useCallback(
    (taskId: string, stageId: string, index: number) => ({
      draggable: true,
      onDragStart: (e: React.DragEvent) => {
        e.dataTransfer.effectAllowed = "move";
        // Some browsers refuse to start a drag without payload.
        e.dataTransfer.setData("text/plain", taskId);
        setDragTaskId(taskId);
      },
      onDragOver: (e: React.DragEvent) => {
        if (!dragTaskId || dragTaskId === taskId) return;
        e.preventDefault();
        e.stopPropagation();
        // Past the halfway line means "after this card", which is what makes
        // dropping at the very bottom of a column reachable.
        const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const after = e.clientY > box.top + box.height / 2;
        setTarget({ stageId, index: after ? index + 1 : index });
      },
      onDragEnd: reset,
    }),
    [dragTaskId, reset],
  );

  const columnProps = useCallback(
    (stageId: string, count: number) => ({
      onDragOver: (e: React.DragEvent) => {
        if (!dragTaskId) return;
        e.preventDefault();
        // Empty space below the cards drops at the end of the column.
        setTarget((prev) => (prev?.stageId === stageId ? prev : { stageId, index: count }));
      },
      onDragLeave: (e: React.DragEvent) => {
        if ((e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) return;
        setTarget((prev) => (prev?.stageId === stageId ? null : prev));
      },
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        if (dragTaskId && target) onMove(dragTaskId, target.stageId, target.index);
        reset();
      },
    }),
    [dragTaskId, target, onMove, reset],
  );

  return { dragTaskId, target, cardProps, columnProps };
}
