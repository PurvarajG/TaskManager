import { handle, json } from "@/lib/api";
import { store } from "@/lib/store";
import * as v from "@/lib/validate";

export async function GET() {
  return handle(async () => store.getNote());
}

export async function PUT(request: Request) {
  return handle(async () => {
    const b = v.body(await json(request));
    return store.saveNote(v.str(b.body, "Note", 100_000));
  });
}
