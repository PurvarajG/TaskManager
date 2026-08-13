import { handle } from "@/lib/api";
import { store } from "@/lib/store";

export async function POST() {
  return handle(async () => (await store.stopTimer()) ?? { stopped: null });
}
