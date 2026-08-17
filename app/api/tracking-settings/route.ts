import { handle, json } from "@/lib/api";
import { store } from "@/lib/store";
import * as v from "@/lib/validate";

export async function GET() {
  return handle(async () => store.getTrackingSettings());
}

export async function PATCH(request: Request) {
  return handle(async () => {
    const b = v.body(await json(request));
    return store.updateTrackingSettings({
      ...(b.dayStartHour !== undefined ? { dayStartHour: v.hour(b.dayStartHour, "dayStartHour") } : {}),
      ...(b.wakingStartHour !== undefined ? { wakingStartHour: v.hour(b.wakingStartHour, "wakingStartHour") } : {}),
      ...(b.wakingEndHour !== undefined ? { wakingEndHour: v.hour(b.wakingEndHour, "wakingEndHour") } : {}),
      ...(b.minGapMinutes !== undefined ? { minGapMinutes: v.minutes(b.minGapMinutes, "minGapMinutes") } : {}),
      ...(b.moduleOrder !== undefined ? { moduleOrder: v.stringList(b.moduleOrder, "moduleOrder") } : {}),
      ...(b.hiddenModules !== undefined ? { hiddenModules: v.stringList(b.hiddenModules, "hiddenModules") } : {}),
      ...(b.collapsedModules !== undefined
        ? { collapsedModules: v.stringList(b.collapsedModules, "collapsedModules") }
        : {}),
      ...(b.hiddenNavItems !== undefined
        ? { hiddenNavItems: v.stringList(b.hiddenNavItems, "hiddenNavItems") }
        : {}),
    });
  });
}
