"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Task } from "@/lib/types";
import { toISODate } from "@/lib/parse";
import SectionLabel from "@/components/SectionLabel";
import TaskRow from "@/components/TaskRow";

function SearchResults() {
  const params = useSearchParams();
  const q = params.get("q") ?? "";
  const [results, setResults] = useState<Task[]>([]);
  const [ready, setReady] = useState(false);
  const todayISO = toISODate(new Date());

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      setReady(true);
      return;
    }
    setReady(false);
    fetch(`/api/tasks?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then(setResults)
      .finally(() => setReady(true));
  }, [q]);

  return (
    <div className="mx-auto max-w-3xl px-6 py-12 sm:px-10 sm:py-16">
      <SectionLabel>Search</SectionLabel>
      <h1 className="mt-5 font-display text-4xl leading-[1.1] tracking-[-0.02em] sm:text-5xl">
        &ldquo;{q}&rdquo;
      </h1>

      {ready && results.length === 0 && (
        <p className="mt-10 rounded-xl border border-dashed border-border px-6 py-14 text-center text-sm text-muted-foreground">
          Nothing matched.
        </p>
      )}

      <ul className="mt-10 space-y-2.5">
        {results.map((t) => (
          <TaskRow key={t.id} task={t} todayISO={todayISO} showDate />
        ))}
      </ul>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchResults />
    </Suspense>
  );
}
