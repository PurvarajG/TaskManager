import { categoryColorVar } from "./colors";

/** The colour swatch used everywhere a category is named but not filled — pickers, legends, lists. */
export default function CategoryDot({ color, className = "" }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={`size-2 shrink-0 rounded-full ${className}`}
      style={{ background: categoryColorVar(color) }}
    />
  );
}
