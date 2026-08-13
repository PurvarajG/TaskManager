import { handle } from "@/lib/api";
import { store } from "@/lib/store";
import * as v from "@/lib/validate";

export async function GET(request: Request) {
  const projectId = new URL(request.url).searchParams.get("projectId");
  return handle(async () =>
    store.listStages(projectId ? v.uuid(projectId, "projectId") : undefined),
  );
}
