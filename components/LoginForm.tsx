"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(body.error ?? "Unable to sign in");
        return;
      }
      router.replace(nextPath);
      router.refresh();
    } catch {
      setError("Unable to sign in. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-5">
      <div>
        <label htmlFor="owner-password" className="mb-2 block text-sm font-semibold">Password</label>
        <div className="flex rounded-xl border border-border bg-background focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
          <input
            id="owner-password"
            type={show ? "text" : "password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            autoFocus
            required
            className="min-w-0 flex-1 bg-transparent px-4 py-3 outline-none"
          />
          <button type="button" onClick={() => setShow((value) => !value)} className="px-4 text-sm text-muted-foreground hover:text-foreground">
            {show ? "Hide" : "Show"}
          </button>
        </div>
      </div>
      <p role="alert" aria-live="polite" className="min-h-5 text-sm text-red-600 dark:text-red-400">{error}</p>
      <button disabled={pending || !password} className="w-full rounded-xl bg-accent px-4 py-3 font-semibold text-accent-foreground shadow-accent transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50">
        {pending ? "Unlocking…" : "Unlock Task Manager"}
      </button>
    </form>
  );
}
