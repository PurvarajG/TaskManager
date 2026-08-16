"use client";

import { useCallback, useState } from "react";
import type { TrackingSettings } from "../types";
import { request } from "./request";

export type TrackingConfigApi = {
  settings: TrackingSettings | null;
  setSettings: React.Dispatch<React.SetStateAction<TrackingSettings | null>>;
  patchSettings: (
    patch: Partial<Omit<TrackingSettings, "updatedAt">>,
  ) => Promise<void>;
};

export function useTrackingConfig(onError: (message: string) => void): TrackingConfigApi {
  const [settings, setSettings] = useState<TrackingSettings | null>(null);

  const patchSettings = useCallback(
    async (patch: Partial<Omit<TrackingSettings, "updatedAt">>) => {
      let before: TrackingSettings | null = null;
      setSettings((prev) => {
        before = prev;
        return prev ? { ...prev, ...patch } : prev;
      });
      try {
        const saved = await request<TrackingSettings>("/api/tracking-settings", {
          method: "PATCH",
          body: JSON.stringify(patch),
        });
        setSettings(saved);
      } catch (error) {
        setSettings(before);
        onError((error as Error).message);
      }
    },
    [onError],
  );

  return { settings, setSettings, patchSettings };
}
