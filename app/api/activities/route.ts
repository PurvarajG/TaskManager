import { handle, json } from "@/lib/api";
import { store } from "@/lib/store";
import * as v from "@/lib/validate";

export async function GET(request: Request) {
  const categoryId = new URL(request.url).searchParams.get("categoryId");
  return handle(async () =>
    store.listActivities(categoryId ? v.uuid(categoryId, "categoryId") : undefined),
  );
}

export async function POST(request: Request) {
  return handle(async () => {
    const b = v.body(await json(request));
    return store.addActivity({
      categoryId: v.uuid(b.categoryId, "categoryId"),
      name: v.nonEmpty(b.name, "Activity name", 80),
      typicalMinutes: b.typicalMinutes !== undefined ? v.minutes(b.typicalMinutes, "typicalMinutes") : undefined,
      isPreset: b.isPreset !== undefined ? v.bool(b.isPreset, "isPreset") : undefined,
      pinned: b.pinned !== undefined ? v.bool(b.pinned, "pinned") : undefined,
    });
  }, 201);
}
