import { GENERAL_NOTE_ID, type GeneralNote } from "../types";
import { db, ts } from "./rows";

type NoteRow = { body: string; updated_at: string };

/** There is always exactly one note; migration seeds it, so this cannot miss. */
export async function getNote(): Promise<GeneralNote> {
  const rows = await db.query<NoteRow>(`select body, updated_at from general_note where id = $1`, [
    GENERAL_NOTE_ID,
  ]);
  if (rows.length === 0) return { body: "", updatedAt: new Date(0).toISOString() };
  return { body: rows[0].body, updatedAt: ts(rows[0].updated_at) };
}

export async function saveNote(body: string): Promise<GeneralNote> {
  const rows = await db.query<NoteRow>(
    `insert into general_note (id, body, updated_at) values ($1, $2, now())
     on conflict (id) do update set body = excluded.body, updated_at = now()
     returning body, updated_at`,
    [GENERAL_NOTE_ID, body],
  );
  return { body: rows[0].body, updatedAt: ts(rows[0].updated_at) };
}
