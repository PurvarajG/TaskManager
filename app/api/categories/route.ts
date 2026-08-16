import { handle, json } from "@/lib/api";
import { store } from "@/lib/store";
import * as v from "@/lib/validate";

export async function GET() {
  return handle(async () => store.listCategories());
}

export async function POST(request: Request) {
  return handle(async () => {
    const b = v.body(await json(request));
    return store.addCategory({
      name: v.nonEmpty(b.name, "Category name", 80),
      color: v.nonEmpty(b.color, "color", 40),
      kind: v.categoryKind(b.kind, "kind"),
    });
  }, 201);
}
