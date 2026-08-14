"use client";

import { useState } from "react";
import { useTasks } from "@/lib/store-context";

export default function QuickAdd({
  projectId,
  autoFocus = true,
  compact = false,
}: {
  projectId?: string;
  autoFocus?: boolean;
  compact?: boolean;
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
          className={`${compact ? "h-11 pl-4 text-sm" : "h-14 pl-5 text-[15px]"} w-full rounded-xl border border-border bg-card pr-28 shadow-sm outline-none transition-all placeholder:text-muted-foreground/60 focus:border-accent/40 focus:ring-2 focus:ring-accent/20`}
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className={`${compact ? "h-8 px-3 text-xs" : "h-10 px-4 text-sm"} absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-gradient-to-r from-accent to-accent-secondary font-medium text-accent-foreground shadow-sm transition-all duration-200 hover:shadow-accent hover:brightness-110 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-0`}
        >
          Add
        </button>
      </div>
      <p className={`${compact ? "mt-1.5 text-[10px]" : "mt-2.5 text-[11px]"} px-1 font-mono uppercase tracking-[0.12em] text-muted-foreground`}>
        30m · p1 · thu · 3pm · weekly · #project · @tag
      </p>
    </form>
  );
}
