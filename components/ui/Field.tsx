"use client";

import { useState } from "react";

export const labelClass =
  "font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground";

export const inputClass =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-accent/40 focus:ring-2 focus:ring-accent/20";

export function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className={labelClass}>
        {label}
      </label>
      {children}
    </div>
  );
}

/**
 * A text input that saves on blur (and on Enter for single-line fields) rather
 * than on every keystroke, so a slow network never fights the cursor. Local
 * state is authoritative while focused; the saved value takes over after.
 */
export function SavingInput({
  id,
  label,
  value,
  onSave,
  multiline = false,
  placeholder,
  rows = 4,
}: {
  id: string;
  label: string;
  value: string;
  onSave: (next: string) => void;
  multiline?: boolean;
  placeholder?: string;
  rows?: number;
}) {
  const [draft, setDraft] = useState(value);
  const [adopted, setAdopted] = useState(value);
  const [focused, setFocused] = useState(false);

  // Adopt outside changes (another surface edited the same task), but never
  // yank the text out from under someone who is mid-sentence. Adjusting during
  // render rather than in an effect avoids a second pass with stale text.
  if (!focused && value !== adopted) {
    setAdopted(value);
    setDraft(value);
  }

  const shared = {
    id,
    value: draft,
    placeholder,
    onFocus: () => setFocused(true),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDraft(e.target.value),
    onBlur: () => {
      setFocused(false);
      if (draft !== value) onSave(draft);
    },
    className: inputClass,
  };

  return (
    <Field label={label} htmlFor={id}>
      {multiline ? (
        <textarea {...shared} rows={rows} className={`${inputClass} resize-y`} />
      ) : (
        <input
          {...shared}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
        />
      )}
    </Field>
  );
}
