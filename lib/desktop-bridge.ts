export type TempoCommand =
  | { type: "new-task" }
  | { type: "focus-search" }
  | { type: "toggle-timer" }
  | { type: "navigate"; path: string };

export type TempoTimerStatus = { label: string; startedAt: string } | null;

declare global {
  interface Window {
    tempo?: {
      onCommand: (callback: (command: TempoCommand) => void) => () => void;
      setBadge: (count: number) => void;
      setTimerStatus: (status: TempoTimerStatus) => void;
      setCanToggleTimer: (canToggle: boolean) => void;
      notify: (title: string, options?: { body?: string; tag?: string }) => void;
      platform: string;
    };
  }
}
