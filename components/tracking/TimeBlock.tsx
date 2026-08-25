import type { CSSProperties } from "react";
import { categoryColorVar, categoryTint } from "./colors";

/**
 * A segment on the timeline, in one of two treatments — same palette, two
 * readings. Sparse contexts (a handful of blocks) read fine as solid colour;
 * a continuous day of 20+ contiguous blocks would read as a paintbox at full
 * saturation, so the ribbon uses a 12% tint with a saturated left rule
 * instead. Positioning (absolute, top/height or left/width) is the caller's.
 */
export default function TimeBlock({
  color,
  label,
  density = "sparse",
  faded = false,
  /** A task's project colour — rendered as a small dot ahead of the label, since a task-linked block belongs to something bigger than its category. */
  projectColor,
  onClick,
  style,
  className = "",
}: {
  color: string;
  label: string;
  density?: "sparse" | "continuous";
  /** Completed/inactive states dim without changing the palette. */
  faded?: boolean;
  projectColor?: string;
  onClick?: () => void;
  style?: CSSProperties;
  className?: string;
}) {
  const Tag = onClick ? "button" : "div";
  const sparse = density === "sparse";

  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      title={label}
      className={`truncate rounded px-2 text-left text-[10px] font-medium transition-opacity ${
        onClick ? "hover:opacity-85" : ""
      } ${faded ? "opacity-55 line-through" : ""} ${sparse ? "shadow-sm" : "border-l-[3px]"} ${className}`}
      style={{
        ...style,
        backgroundColor: sparse ? categoryColorVar(color) : categoryTint(color, 12),
        color: sparse ? "var(--color-accent-foreground)" : "var(--color-foreground)",
        borderLeftColor: sparse ? undefined : categoryColorVar(color),
      }}
    >
      <span className="flex items-center gap-1 truncate">
        {projectColor && (
          <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ background: projectColor }} />
        )}
        <span className="truncate">{label}</span>
      </span>
    </Tag>
  );
}
