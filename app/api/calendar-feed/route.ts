import { passwordMatches } from "@/lib/auth";
import { buildIcsFeed } from "@/lib/ics";
import { store } from "@/lib/store";

/**
 * The one route that sits outside `proxy.ts`'s session gate (it's listed in
 * PUBLIC_PATHS): Apple Calendar re-polls this URL on its own schedule and has
 * nowhere to put a login cookie. It pays for that exemption with its own
 * constant-time token check below — so if it ever falls *out* of PUBLIC_PATHS,
 * the feed gets harder to reach, never easier.
 */
export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CALENDAR_FEED_SECRET;
  if (!secret) {
    return Response.json({ error: "Calendar feed is not configured" }, { status: 503 });
  }

  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!(await passwordMatches(token, secret))) {
    return Response.json({ error: "Invalid feed token" }, { status: 401 });
  }

  const feed = buildIcsFeed(await store.allTasks());
  return new Response(feed, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      // Apple decides when to re-poll; nothing in between should answer for us.
      "Cache-Control": "no-store, max-age=0",
      "Content-Disposition": 'inline; filename="dayplan.ics"',
    },
  });
}
