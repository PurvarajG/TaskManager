"use client";

import { useState } from "react";
import { useTasks } from "@/lib/store-context";

export default function QuickAdd({
  projectId,
  autoFocus = true,
}: {
  projectId?: string;
  autoFocus?: boolean;
}) {
  const { addTask } = useTasks();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    const raw = text.trim();
    if (!raw || busy) return;
    setText("");
    setBusy(true);
    try {
      await addTask(raw, { projectId });
    } catch {
      setText(raw);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className="relative">
        <input
          autoFocus={autoFocus}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder="What needs doing?"
          className="h-14 w-full rounded-xl border border-border bg-card pl-5 pr-28 text-[15px] shadow-sm outline-none transition-all placeholder:text-muted-foreground/60 focus:border-accent/40 focus:ring-2 focus:ring-accent/20"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="absolute right-2 top-1/2 h-10 -translate-y-1/2 rounded-lg bg-gradient-to-r from-accent to-accent-secondary px-4 text-sm font-medium text-accent-foreground shadow-sm transition-all duration-200 hover:shadow-accent hover:brightness-110 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-0"
        >
          Add
        </button>
      </div>
      <p className="mt-2.5 px-1 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
        30m · p1 · thu · 3pm · weekly · #project · @tag
      </p>
    </form>
  );
}
