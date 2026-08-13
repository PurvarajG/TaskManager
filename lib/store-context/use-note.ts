"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GeneralNote } from "../types";
import { request } from "./request";

export type SaveState = "idle" | "saving" | "saved" | "error";

export type NoteApi = {
  note: string;
  noteState: SaveState;
  setNote: (body: string) => void;
  retryNote: () => void;
  loadNote: (note: GeneralNote) => void;
};

const DEBOUNCE_MS = 700;

/**
 * Debounced autosave with three visible states. On failure the text stays in
 * component state (so nothing the user typed is lost) and `retryNote` sends
 * exactly what is on screen.
 */
export function useNote(): NoteApi {
  const [note, setNoteText] = useState("");
  const [noteState, setNoteState] = useState<SaveState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<string>("");

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const save = useCallback(async (body: string) => {
    setNoteState("saving");
    try {
      await request("/api/note", { method: "PUT", body: JSON.stringify({ body }) });
      // A later keystroke may have already queued another save; don't claim
      // "Saved" for text that is no longer what's on screen.
      if (pending.current === body) setNoteState("saved");
    } catch {
      setNoteState("error");
    }
  }, []);

  const setNote = useCallback(
    (body: string) => {
      setNoteText(body);
      pending.current = body;
      // "Saving" from the first keystroke, not from when the request leaves:
      // during the debounce the text genuinely is not saved yet, and claiming
      // otherwise would be the one moment the indicator could mislead.
      setNoteState("saving");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void save(body), DEBOUNCE_MS);
    },
    [save],
  );

  const retryNote = useCallback(() => void save(pending.current), [save]);

  const loadNote = useCallback((loaded: GeneralNote) => {
    setNoteText(loaded.body);
    pending.current = loaded.body;
  }, []);

  return { note, noteState, setNote, retryNote, loadNote };
}
