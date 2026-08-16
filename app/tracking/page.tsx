"use client";

import { useEffect, useState } from "react";
import SectionLabel from "@/components/SectionLabel";
import ModuleCard from "@/components/tracking/ModuleCard";
import NowModule from "@/components/tracking/modules/NowModule";
import RecordsModule from "@/components/tracking/modules/RecordsModule";
import RibbonModule from "@/components/tracking/modules/RibbonModule";
import RollupsModule from "@/components/tracking/modules/RollupsModule";
import SignalsModule from "@/components/tracking/modules/SignalsModule";
import UnaccountedModule from "@/components/tracking/modules/UnaccountedModule";
import { useTasks } from "@/lib/store-context";
import { currentTrackingDayISO, dayWindow, shiftTrackingDay } from "@/lib/tracking-day";
import { MODULE_TITLE } from "@/lib/tracking-modules";
import { useNow } from "@/lib/useNow";

export default function TrackingPage() {
  const { settings, categories, segments, ready, loadSegments, loadGaps } = useTasks();
  const now = useNow();
  const [dayISO, setDayISO] = useState<string | null>(null);

  // Default to the current tracking day once we know the day-start hour —
  // never before, since a 4am boundary can put "today" as yesterday's date.
  // Adjusted during render (not an effect) so there's no extra pass with a
  // stale null day, same pattern as SavingInput adopting an outside value.
  if (dayISO === null && now && settings) {
    setDayISO(currentTrackingDayISO(now, settings.dayStartHour));
  }

  useEffect(() => {
    if (!dayISO || !settings) return;
    const { start, end } = dayWindow(dayISO, settings);
    loadSegments(start.toISOString(), end.toISOString());
    loadGaps(dayISO);
  }, [dayISO, settings, loadSegments, loadGaps]);

  // Gaps are a server-side computation, not something the optimistic segment
  // update can adjust locally. Every store mutation (start/stop/switch/patch/
  // delete/fill) replaces the segments array, including a stop — which only
  // mutates a segment in place, so `.length` alone would miss it — so this
  // re-derives gaps on any change to the array reference itself.
  useEffect(() => {
    if (dayISO) loadGaps(dayISO);
  }, [segments, dayISO, loadGaps]);

  if (!now || !settings || !dayISO) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-12 sm:px-10 sm:py-16">
        <div className="h-10 w-64 rounded-lg bg-muted" />
      </div>
    );
  }

  if (ready && categories.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-12 sm:px-10 sm:py-16">
        <SectionLabel>Tracking</SectionLabel>
        <p className="mt-6 text-sm text-muted-foreground">
          No categories yet.{" "}
          <a href="/tracking/settings" className="text-accent hover:underline">
            Set some up
          </a>{" "}
          before tracking time.
        </p>
      </div>
    );
  }

  const todayISO = currentTrackingDayISO(now, settings.dayStartHour);
  const isToday = dayISO === todayISO;
  const dayLabel = new Date(`${dayISO}T00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const order = settings.moduleOrder.filter((key) => !settings.hiddenModules.includes(key));

  return (
    <div className="mx-auto max-w-4xl px-6 py-12 sm:px-10 sm:py-16">
      <SectionLabel pulse={isToday}>Tracking</SectionLabel>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl leading-[1.1] tracking-[-0.02em] sm:text-4xl">
          {isToday ? "Today" : dayLabel}
        </h1>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setDayISO(shiftTrackingDay(dayISO, -1))}
            aria-label="Previous day"
            className="flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground sm:size-9"
          >
            ‹
          </button>
          <button
            onClick={() => setDayISO(todayISO)}
            disabled={isToday}
            className="rounded-lg px-3 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
          >
            Today
          </button>
          <button
            onClick={() => setDayISO(shiftTrackingDay(dayISO, 1))}
            aria-label="Next day"
            className="flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground sm:size-9"
          >
            ›
          </button>
          <a
            href="/tracking/settings"
            aria-label="Tracking settings"
            className="ml-1 flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground sm:size-9"
          >
            ⚙
          </a>
        </div>
      </div>

      <div className="mt-8 space-y-5">
        {order.map((key) => (
          <ModuleCard key={key} title={MODULE_TITLE[key] ?? key}>
            {key === "now" && <NowModule />}
            {key === "unaccounted" && <UnaccountedModule dayISO={dayISO} />}
            {key === "ribbon" && <RibbonModule dayISO={dayISO} isToday={isToday} />}
            {key === "rollups" && <RollupsModule dayISO={dayISO} todayISO={todayISO} now={now} />}
            {key === "signals" && <SignalsModule dayISO={dayISO} todayISO={todayISO} now={now} />}
            {key === "records" && <RecordsModule now={now} />}
          </ModuleCard>
        ))}
      </div>
    </div>
  );
}
