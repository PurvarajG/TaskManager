"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

/**
 * The subscribe URL is built in the browser rather than on the server: the app
 * runs behind a proxy in production, so `window.location` is the only place
 * that reliably knows the host you actually reached it on.
 *
 * Deliberately `http(s)://`, not `webcal://`: macOS Calendar's `webcal:`
 * handler tries HTTPS first regardless of what the target actually serves,
 * and does not fall back to plain HTTP on failure — confirmed via
 * `log show`, which shows CalendarAgent's fetch dying with
 * NSURLErrorSecureConnectionFailed (-1200) then NSURLErrorUnsupportedURL
 * (-1002) against this exact feed. Handing Calendar the real scheme we're
 * actually serving sidesteps that translation entirely.
 */
function feedUrl(token: string): string {
  return `${window.location.protocol}//${window.location.host}/api/calendar-feed?token=${encodeURIComponent(token)}`;
}

/** The host never changes under us, so there is nothing to subscribe to. */
const noSubscription = () => () => {};

export default function CalendarFeed({ token }: { token: string | null }) {
  const [copied, setCopied] = useState(false);

  // The server has no `window`, so it renders an empty field and the client
  // fills it in on hydration — without a render-phase mismatch or a setState
  // in an effect. Equal strings are `Object.is`-equal, so this never loops.
  const url = useSyncExternalStore(
    noSubscription,
    () => (token ? feedUrl(token) : ""),
    () => "",
  );

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  if (!token) {
    return (
      <div className="rounded-xl border border-dashed border-border px-6 py-8 text-sm text-muted-foreground">
        <p className="text-foreground">The calendar feed isn&apos;t set up yet.</p>
        <p className="mt-3">
          In the desktop app, open{" "}
          <span className="text-foreground">File → Calendar Integration Settings…</span> — a token
          is generated for you on first launch; restart Tempo if the file was empty. Running from
          source instead, set{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">CALENDAR_FEED_SECRET</code>{" "}
          to a long random string in your environment and restart.
        </p>
        <p className="mt-3">
          Treat it like a password — it&apos;s the only thing standing between your task list and
          anyone who guesses the URL.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border px-6 py-6">
      <p className="text-sm text-muted-foreground">
        Add this URL in Apple Calendar under{" "}
        <span className="text-foreground">File → New Calendar Subscription</span>, or open it on
        your phone. Your open tasks appear as events; completed ones drop off at the next refresh.
      </p>

      <div className="mt-4 flex gap-2">
        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="h-9 flex-1 rounded-lg border border-border bg-card px-3 font-mono text-xs outline-none focus:border-accent/40"
        />
        <button
          onClick={async () => {
            await navigator.clipboard?.writeText(url);
            setCopied(true);
          }}
          className="h-9 shrink-0 rounded-lg border border-border px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        In the desktop app the feed is served by Tempo itself, so Apple Calendar only refreshes
        while Tempo is open — close it and you keep seeing the last events it fetched.
      </p>

      <p className="mt-3 text-xs text-muted-foreground">
        Anyone with this link can read your tasks — it carries the feed token. Rotate{" "}
        <code className="font-mono">CALENDAR_FEED_SECRET</code> to revoke it.
      </p>
    </div>
  );
}
