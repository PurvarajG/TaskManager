"use client";

import { useTasks } from "@/lib/store-context";
import { labelClass } from "@/components/ui/Field";

/** Day start hour, waking window, minimum gap — the boundaries every module's math reads. */
export default function GapRulesSection() {
  const { settings, patchSettings } = useTasks();
  if (!settings) return null;

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <HourField
        label="Day starts at"
        value={settings.dayStartHour}
        onChange={(dayStartHour) => patchSettings({ dayStartHour })}
      />
      <HourField
        label="Waking starts"
        value={settings.wakingStartHour}
        onChange={(wakingStartHour) => patchSettings({ wakingStartHour })}
      />
      <HourField
        label="Waking ends"
        value={settings.wakingEndHour}
        onChange={(wakingEndHour) => patchSettings({ wakingEndHour })}
      />
      <div className="space-y-1.5">
        <label htmlFor="min-gap" className={labelClass}>
          Min gap (min)
        </label>
        <input
          id="min-gap"
          type="number"
          min={1}
          value={settings.minGapMinutes}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (n > 0) patchSettings({ minGapMinutes: n });
          }}
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-accent/40"
        />
      </div>
    </div>
  );
}

function HourField({ label, value, onChange }: { label: string; value: number; onChange: (hour: number) => void }) {
  const id = `hour-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-accent/40"
      >
        {Array.from({ length: 24 }, (_, h) => (
          <option key={h} value={h}>
            {String(h).padStart(2, "0")}:00
          </option>
        ))}
      </select>
    </div>
  );
}
