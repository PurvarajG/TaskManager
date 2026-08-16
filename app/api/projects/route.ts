import { handle, json } from "@/lib/api";
import { store } from "@/lib/store";
import * as v from "@/lib/validate";

export async function GET() {
  return handle(async () => store.listProjects());
}

/** Creating a project also creates its board, so both come back together. */
export async function POST(request: Request) {
  return handle(async () => {
    const b = v.body(await json(request));
    return store.addProject({
      name: v.nonEmpty(b.name, "Project name", 120),
      color: v.optionalStr(b.color, "color", 20),
      defaultCategoryId: v.optionalUuid(b.defaultCategoryId, "defaultCategoryId"),
    });
  }, 201);
}
