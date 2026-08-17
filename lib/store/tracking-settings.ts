import { TRACKING_SETTINGS_ID, type TrackingSettings } from "../types";
import { db, rowToTrackingSettings, type TrackingSettingsRow } from "./rows";

export async function getTrackingSettings(): Promise<TrackingSettings> {
  const rows = await db.query<TrackingSettingsRow>(
    `select * from tracking_settings where id = $1`,
    [TRACKING_SETTINGS_ID],
  );
  return rowToTrackingSettings(rows[0]);
}

export async function updateTrackingSettings(
  patch: Partial<Omit<TrackingSettings, "updatedAt">>,
): Promise<TrackingSettings> {
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  if (patch.dayStartHour !== undefined) {
    sets.push(`day_start_hour = $${i++}`);
    vals.push(patch.dayStartHour);
  }
  if (patch.wakingStartHour !== undefined) {
    sets.push(`waking_start_hour = $${i++}`);
    vals.push(patch.wakingStartHour);
  }
  if (patch.wakingEndHour !== undefined) {
    sets.push(`waking_end_hour = $${i++}`);
    vals.push(patch.wakingEndHour);
  }
  if (patch.minGapMinutes !== undefined) {
    sets.push(`min_gap_minutes = $${i++}`);
    vals.push(patch.minGapMinutes);
  }
  if (patch.moduleOrder !== undefined) {
    sets.push(`module_order = $${i++}`);
    vals.push(patch.moduleOrder);
  }
  if (patch.hiddenModules !== undefined) {
    sets.push(`hidden_modules = $${i++}`);
    vals.push(patch.hiddenModules);
  }
  if (patch.collapsedModules !== undefined) {
    sets.push(`collapsed_modules = $${i++}`);
    vals.push(patch.collapsedModules);
  }
  if (patch.hiddenNavItems !== undefined) {
    sets.push(`hidden_nav_items = $${i++}`);
    vals.push(patch.hiddenNavItems);
  }
  if (sets.length === 0) return getTrackingSettings();

  const rows = await db.query<TrackingSettingsRow>(
    `update tracking_settings set ${sets.join(", ")}, updated_at = now()
      where id = $${i} returning *`,
    [...vals, TRACKING_SETTINGS_ID],
  );
  return rowToTrackingSettings(rows[0]);
}
