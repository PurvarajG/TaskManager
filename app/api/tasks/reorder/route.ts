import { store } from "@/lib/store";

export async function POST(request: Request) {
  const { ids } = (await request.json()) as { ids: string[] };
  if (!Array.isArray(ids) || ids.length === 0) {
    return Response.json({ error: "ids required" }, { status: 400 });
  }
  await store.reorderTasks(ids);
  return new Response(null, { status: 204 });
}
