"use client";

import { useState } from "react";

/**
 * Minimal native-HTML5-DnD reorder: tracks a live-reordered copy of `items`
 * while dragging, and hands the final id order to `onDrop` once released.
 * No dependency needed for a list this small.
 */
export function useDragReorder<T extends { id: string }>(
  items: T[],
  onDrop: (orderedIds: string[]) => void,
) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [order, setOrder] = useState<T[] | null>(null);

  const list = order ?? items;

  function dragHandleProps(id: string) {
    return {
      draggable: true,
      onDragStart: () => setDragId(id),
      onDragOver: (e: React.DragEvent<HTMLLIElement>) => {
        e.preventDefault();
        if (!dragId || dragId === id) return;
        const current = order ?? items;
        const from = current.findIndex((t) => t.id === dragId);
        const to = current.findIndex((t) => t.id === id);
        if (from === -1 || to === -1 || from === to) return;
        const next = current.slice();
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        setOrder(next);
      },
      onDrop: (e: React.DragEvent<HTMLLIElement>) => {
        e.preventDefault();
        finish();
      },
      onDragEnd: finish,
    };
  }

  function finish() {
    if (order) onDrop(order.map((t) => t.id));
    setDragId(null);
    setOrder(null);
  }

  return { list, dragHandleProps };
}
