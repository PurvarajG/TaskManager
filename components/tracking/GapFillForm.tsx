"use client";

import { useState } from "react";
import { useTasks } from "@/lib/store-context";
import type { Gap } from "@/lib/types";
import CategoryPicker from "./CategoryPicker";

/** Category + optional note, then a manual backfill of one gap. Shared by Unaccounted and the ribbon. */
export default function GapFillForm({ gap, onFilled }: { gap: Gap; onFilled: () => void }) {
  const { categories, fillGap } = useTasks();
  const [categoryId, setCategoryId] = useState<string | undefined>(categories[0]?.id);
  const [note, setNote] = useState("");

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
        onClick={() => {
          if (!categoryId) return;
          fillGap({ startedAt: gap.startedAt, endedAt: gap.endedAt, categoryId, note: note || undefined });
          onFilled();
        }}
        disabled={!categoryId}
        className="min-h-11 shrink-0 rounded-lg bg-gradient-to-r from-accent to-accent-secondary px-3 py-2 text-sm font-medium text-accent-foreground hover:brightness-110 disabled:opacity-50 sm:min-h-9"
      >
        Fill
      </button>
    </>
  );
}
