import { handle } from "@/lib/api";
import { store } from "@/lib/store";
import * as v from "@/lib/validate";

export async function GET(request: Request) {
  const date = new URL(request.url).searchParams.get("date");
  return handle(async () => {
    const dayISO = v.isoDate(date, "date");
    const settings = await store.getTrackingSettings();
    return store.findGaps(dayISO, settings);
  });
}
