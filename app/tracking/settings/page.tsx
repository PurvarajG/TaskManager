"use client";

import SectionLabel from "@/components/SectionLabel";
import ActivitiesSection from "@/components/tracking/settings/ActivitiesSection";
import CategoriesSection from "@/components/tracking/settings/CategoriesSection";
import GapRulesSection from "@/components/tracking/settings/GapRulesSection";
import ModuleOrderSection from "@/components/tracking/settings/ModuleOrderSection";
import { useTasks } from "@/lib/store-context";

export default function TrackingSettingsPage() {
  const { ready, settings } = useTasks();

  return (
    <div className="mx-auto max-w-3xl px-6 py-12 sm:px-10 sm:py-16">
      <SectionLabel>Tracking settings</SectionLabel>
      <h1 className="mt-5 font-display text-4xl leading-[1.1] tracking-[-0.02em] sm:text-5xl">
        Configure your <span className="gradient-text">taxonomy</span>
      </h1>

      {!ready || !settings ? (
        <div className="mt-10 h-10 w-64 animate-pulse rounded-lg bg-muted" />
      ) : (
        <div className="mt-10 space-y-10">
          <section>
            <SectionLabel>Categories</SectionLabel>
            <p className="mt-2 text-sm text-muted-foreground">
              The top-level buckets every minute rolls up into. Delete is refused while a category
              still has recorded time — archive it instead.
            </p>
            <div className="mt-4">
              <CategoriesSection />
            </div>
          </section>

          <section>
            <SectionLabel>Activities</SectionLabel>
            <p className="mt-2 text-sm text-muted-foreground">
              What you actually do. Presets show up as one-tap chips on the Now module.
            </p>
            <div className="mt-4">
              <ActivitiesSection />
            </div>
          </section>

          <section>
            <SectionLabel>Gap rules</SectionLabel>
            <p className="mt-2 text-sm text-muted-foreground">
              The day boundary, the waking window gaps are searched within, and the shortest gap
              worth flagging.
            </p>
            <div className="mt-4">
              <GapRulesSection />
            </div>
          </section>

          <section>
            <SectionLabel>Module order &amp; visibility</SectionLabel>
            <p className="mt-2 text-sm text-muted-foreground">
              The dashboard renders modules in this order, skipping any turned off.
            </p>
            <div className="mt-4">
              <ModuleOrderSection />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
