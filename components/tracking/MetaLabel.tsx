/**
 * The mono idiom, so it stops being retyped: every label, hour, date and
 * count in the tracking dashboard speaks in this voice. Sans stays reserved
 * for user content (activity names, notes).
 */
export default function MetaLabel({
  as: Tag = "span",
  children,
  className = "",
}: {
  as?: "span" | "time" | "div";
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Tag className={`font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground ${className}`}>
      {children}
    </Tag>
  );
}
