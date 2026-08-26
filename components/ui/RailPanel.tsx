"use client";

import Panel from "@/components/ui/Panel";

/**
 * A disclosure panel for a page's side rail — a thin wrapper over the shared
 * `Panel` chrome (see components/ui/Panel.tsx), which already implements the
 * quiet dashed-line empty state this component originally introduced.
 */
export default function RailPanel({
  title,
  collapsed,
  onToggleCollapse,
  empty = false,
  emptyText,
  children,
}: {
  title: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
  /** When true, renders the quiet empty-state line instead of the card. */
  empty?: boolean;
  emptyText?: string;
  children: React.ReactNode;
}) {
  return (
    <Panel
      title={title}
      collapsed={collapsed}
      onToggleCollapse={onToggleCollapse}
      empty={empty}
      emptyText={emptyText}
    >
      {children}
    </Panel>
  );
}
