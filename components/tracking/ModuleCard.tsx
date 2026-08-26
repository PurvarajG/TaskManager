"use client";

import Panel from "@/components/ui/Panel";

/**
 * The shell every tracking module uses — none hand-roll it. A thin wrapper
 * over the shared `Panel` chrome (see components/ui/Panel.tsx); kept as its
 * own component so tracking call sites don't need to change their imports.
 */
export default function ModuleCard({
  title,
  action,
  collapsible = true,
  defaultCollapsed = false,
  collapsed,
  onToggleCollapse,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  /** Controlled collapse state — when paired with `onToggleCollapse`, the caller
   *  owns persistence. Omit both to fall back to local state. */
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Panel
      title={title}
      action={action}
      collapsible={collapsible}
      defaultCollapsed={defaultCollapsed}
      collapsed={collapsed}
      onToggleCollapse={onToggleCollapse}
    >
      {children}
    </Panel>
  );
}
