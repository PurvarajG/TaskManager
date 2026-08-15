import SectionLabel from "@/components/SectionLabel";
import CalendarFeed from "@/components/settings/CalendarFeed";

/**
 * A server component so the feed token is read straight from the environment.
 * Handing the token to the browser is safe here and nowhere else: this page is
 * behind the session cookie, and the token's whole job is to end up in a URL
 * you paste into Apple Calendar.
 */
/**
 * Rendered per request, never prerendered: otherwise CALENDAR_FEED_SECRET is
 * read at build time and baked into static HTML, so rotating the secret would
 * need a rebuild and a build without it would show the setup notice forever.
 */
export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const token = process.env.CALENDAR_FEED_SECRET || null;

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
    </div>
  );
}
