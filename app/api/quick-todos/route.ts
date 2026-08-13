import { handle, json } from "@/lib/api";
import { store } from "@/lib/store";
import * as v from "@/lib/validate";

export async function GET() {
  return handle(async () => store.listQuickTodos());
}

export async function POST(request: Request) {
  return handle(async () => {
    const b = v.body(await json(request));
    return store.addQuickTodo(v.nonEmpty(b.title, "Title", 300));
  }, 201);
}
