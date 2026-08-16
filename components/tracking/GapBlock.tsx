import type { CSSProperties } from "react";
import MetaLabel from "./MetaLabel";

/**
 * The only dashed border in the system — absence must never look like another
 * category. Transparent, no fill, mono label. Click fills it.
 */
export default function GapBlock({
  label,
  onClick,
  style,
  className = "",
}: {
  label: string;
  onClick?: () => void;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={`flex items-center justify-center truncate rounded border border-dashed border-border px-2 text-left transition-colors hover:border-accent/40 hover:bg-accent/[0.035] ${className}`}
      style={style}
    >
      <MetaLabel className="truncate">{label}</MetaLabel>
    </button>
  );
}
