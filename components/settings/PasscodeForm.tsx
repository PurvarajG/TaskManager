"use client";

import { useState, type FormEvent } from "react";

export default function PasscodeForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (newPassword !== confirmPassword) {
      setError("New passcode and confirmation don't match");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl border border-border px-6 py-6">
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <input
          type="password"
          placeholder="Current passcode"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          disabled={submitting}
          className="h-9 rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-accent/40"
        />
        <input
          type="password"
          placeholder="New passcode (min 8 characters)"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          disabled={submitting}
          className="h-9 rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-accent/40"
        />
        <input
          type="password"
          placeholder="Confirm new passcode"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={submitting}
          className="h-9 rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-accent/40"
        />

        {error && <p className="text-xs text-red-500">{error}</p>}
        {success && <p className="text-xs text-emerald-500">Passcode changed.</p>}

        <button
          type="submit"
          disabled={submitting || !currentPassword || !newPassword || !confirmPassword}
          className="h-9 self-start rounded-lg border border-border px-4 text-sm text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Saving…" : "Change passcode"}
        </button>
      </form>

      <p className="mt-4 text-xs text-muted-foreground">
        Forgot your passcode? Clear the <code className="font-mono">auth_settings</code> row in
        the database — login then falls back to the <code className="font-mono">APP_PASSWORD</code>{" "}
        environment variable.
      </p>
    </div>
  );
}
