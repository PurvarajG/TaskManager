import SectionLabel from "@/components/SectionLabel";
import CalendarFeed from "@/components/settings/CalendarFeed";
import NavVisibility from "@/components/settings/NavVisibility";

/**
 * A server component so the feed token is read straight from the environment.
 * Handing the token to the browser is intentional: its whole job is to end up
 * in a URL you paste into Apple Calendar.
 */
/**
 * Rendered per request, never prerendered: otherwise CALENDAR_FEED_SECRET is
 * read at build time and baked into static HTML, so rotating the secret would
 * need a rebuild and a build without it would show the setup notice forever.
 */
export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const token = process.env.CALENDAR_FEED_SECRET || null;
  const icloudConfigured = Boolean(process.env.ICLOUD_APPLE_ID && process.env.ICLOUD_APP_PASSWORD);

  return (
    <div className="mx-auto max-w-3xl px-6 py-12 sm:px-10 sm:py-16">
      <SectionLabel>Settings</SectionLabel>
      <h1 className="mt-5 font-display text-4xl leading-[1.1] tracking-[-0.02em] sm:text-5xl">
        Apple <span className="gradient-text">Calendar</span>
      </h1>

      <section className="mt-10">
        <SectionLabel>Subscribe to your tasks</SectionLabel>
        <div className="mt-5">
          <CalendarFeed token={token} />
        </div>
      </section>

      <section className="mt-10">
        <SectionLabel>Show your iCloud events</SectionLabel>
        <div className="mt-5 rounded-xl border border-border px-6 py-6 text-sm text-muted-foreground">
          {icloudConfigured ? (
            <p>
              <span className="text-foreground">Connected.</span> Your iCloud events appear on the
              Calendar page, read-only. They are fetched fresh every few minutes and never written
              back.
            </p>
          ) : (
            <>
              <p className="text-foreground">iCloud events aren&apos;t connected yet.</p>
              <p className="mt-3">
                In the desktop app, open{" "}
                <span className="text-foreground">File → Calendar Integration Settings…</span> and
                fill in <code className="font-mono text-xs">icloudAppleId</code> and{" "}
                <code className="font-mono text-xs">icloudAppPassword</code>, then restart Tempo.
                Running from source, set{" "}
                <code className="font-mono text-xs">ICLOUD_APPLE_ID</code> /{" "}
                <code className="font-mono text-xs">ICLOUD_APP_PASSWORD</code> instead.
              </p>
              <p className="mt-3">
                The password must be an app-specific password from appleid.apple.com — iCloud
                CalDAV rejects your real Apple ID password once two-factor is on.
              </p>
            </>
          )}
        </div>
      </section>

      <section className="mt-10">
        <SectionLabel>Sidebar</SectionLabel>
        <div className="mt-5">
          <NavVisibility />
        </div>
      </section>
    </div>
  );
}
