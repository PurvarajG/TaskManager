import { store } from "@/lib/store";
import type { ProjectInput } from "@/lib/types";

export async function GET() {
  return Response.json(await store.listProjects());
}

export async function POST(request: Request) {
  const body = (await request.json()) as ProjectInput;
  if (!body.name?.trim()) {
    return Response.json({ error: "A project needs a name" }, { status: 400 });
  }
  return Response.json(await store.addProject(body), { status: 201 });
}
