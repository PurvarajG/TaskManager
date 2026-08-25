"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Task } from "@/lib/types";
import { toISODate } from "@/lib/parse";
import TaskRow from "@/components/TaskRow";
import PageShell from "@/components/ui/PageShell";

function SearchResults() {
  const params = useSearchParams();
  const q = params.get("q") ?? "";
  // Results are stored with the query they belong to, so "still loading" is a
  // comparison rather than a flag an effect has to keep in sync.
  const [data, setData] = useState<{ q: string; results: Task[] } | null>(null);
  const results = data?.q === q ? data.results : [];
  const ready = !q.trim() || data?.q === q;
  const todayISO = toISODate(new Date());

  useEffect(() => {
    if (!q.trim()) return;
    let current = true;
    fetch(`/api/tasks?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((found: Task[]) => {
        // A slower earlier query must not overwrite a newer one's results.
        if (current) setData({ q, results: found });
      })
      .catch(() => {
        if (current) setData({ q, results: [] });
      });
    return () => {
      current = false;
    };
  }, [q]);

  return (
    <PageShell label="Search" title={<>&ldquo;{q}&rdquo;</>}>
      {ready && results.length === 0 && (
        <p className="rounded-xl border border-dashed border-border px-6 py-14 text-center text-sm text-muted-foreground">
          Nothing matched.
        </p>
      )}

      <ul className="space-y-2.5">
        {results.map((t) => (
          <TaskRow key={t.id} task={t} todayISO={todayISO} showDate />
        ))}
      </ul>
    </PageShell>
  );
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchResults />
    </Suspense>
  );
}
