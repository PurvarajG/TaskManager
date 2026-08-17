import { AUTH_SETTINGS_ID } from "../types";
import { hashPassword } from "../password";
import { db } from "./rows";

type AuthSettingsRow = { password_hash: string | null; password_salt: string | null };

export async function getStoredPassword(): Promise<{ hash: string; salt: string } | null> {
  const rows = await db.query<AuthSettingsRow>(
    `select password_hash, password_salt from auth_settings where id = $1`,
    [AUTH_SETTINGS_ID],
  );
  const row = rows[0];
  if (!row || !row.password_hash || !row.password_salt) return null;
  return { hash: row.password_hash, salt: row.password_salt };
}

export async function setStoredPassword(plain: string): Promise<void> {
  const { hash, salt } = hashPassword(plain);
  await db.query(
    `update auth_settings set password_hash = $1, password_salt = $2, updated_at = now() where id = $3`,
    [hash, salt, AUTH_SETTINGS_ID],
  );
}
