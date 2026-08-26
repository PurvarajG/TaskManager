import SectionLabel from "@/components/SectionLabel";
import CalendarFeed from "@/components/settings/CalendarFeed";
import NavVisibility from "@/components/settings/NavVisibility";
import SettingsNav from "@/components/settings/SettingsNav";
import PageShell from "@/components/ui/PageShell";

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

/**
 * Phase 7 (design-prototypes/tempo-focus/index.html's `#settings`): the
 * prototype's two-pane `.settings-layout` — a sticky section jumplist beside
 * grouped setting cards. `SettingsNav` is the only client piece; the page
 * itself stays a server component (see above) and just gives the nav the
 * section ids/labels to track.
 */
const SECTIONS = [
  { id: "calendar", label: "Calendar" },
  { id: "sidebar", label: "Sidebar" },
];

export default function SettingsPage() {
  const token = process.env.CALENDAR_FEED_SECRET || null;
  const icloudConfigured = Boolean(process.env.ICLOUD_APPLE_ID && process.env.ICLOUD_APP_PASSWORD);

  return (
    <PageShell
      label="Settings"
      title={
        <>
          Apple <span className="gradient-text">Calendar</span>
        </>
      }
      subtitle="Integrations and navigation, in one structured workspace."
      maxWidth="max-w-5xl"
    >
      <div className="grid grid-cols-1 gap-8 shell:grid-cols-[var(--width-nav-rail)_minmax(0,1fr)]">
        <SettingsNav sections={SECTIONS} />

        <div className="min-w-0 max-w-2xl space-y-10">
          <section id="calendar" aria-labelledby="calendar-heading" className="scroll-mt-6">
            <h2 id="calendar-heading">
              <SectionLabel>Subscribe to your tasks</SectionLabel>
            </h2>
            <div className="mt-5">
              <CalendarFeed token={token} />
            </div>

            <div className="mt-6">
              <h3>
                <SectionLabel>Show your iCloud events</SectionLabel>
              </h3>
              <div className="mt-5 rounded-xl border border-border px-6 py-6 text-sm text-muted-foreground">
                {icloudConfigured ? (
                  <p>
                    <span className="text-foreground">Connected.</span> Your iCloud events appear on
                    the Calendar page, read-only. They are fetched fresh every few minutes and never
                    written back.
                  </p>
                ) : (
                  <>
                    <p className="text-foreground">iCloud events aren&apos;t connected yet.</p>
                    <p className="mt-3">
                      In the desktop app, open{" "}
                      <span className="text-foreground">File → Calendar Integration Settings…</span>{" "}
                      and fill in <code className="font-mono text-xs">icloudAppleId</code> and{" "}
                      <code className="font-mono text-xs">icloudAppPassword</code>, then restart
                      Tempo. Running from source, set{" "}
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
            </div>
          </section>

          <section id="sidebar" aria-labelledby="sidebar-heading" className="scroll-mt-6">
            <h2 id="sidebar-heading">
              <SectionLabel>Sidebar</SectionLabel>
            </h2>
            <div className="mt-5">
              <NavVisibility />
            </div>
          </section>
        </div>
      </div>
    </PageShell>
  );
}
