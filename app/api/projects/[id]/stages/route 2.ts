import { handle, json } from "@/lib/api";
import { store } from "@/lib/store";
import * as v from "@/lib/validate";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  const { id } = await params;
  return handle(async () => store.listStages(v.uuid(id, "project id")));
}

export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params;
  return handle(async () => {
    const b = v.body(await json(request));
    const projectId = v.uuid(id, "project id");
    if (!(await store.getProject(projectId))) return null;
    return store.addStage(projectId, {
      name: v.nonEmpty(b.name, "Column name", 80),
      kind: v.stageKind(b.kind, "kind"),
    });
  }, 201);
}
