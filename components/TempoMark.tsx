import { useId } from "react";

/**
 * Inline SVG brand mark for Tempo — three rounded bars of varying height.
 *
 * Geometry is transcribed (not redrawn by eye) from the design source of
 * truth at brand/tempo-mark.svg — the same file scripts/make-icon.mjs
 * renders into build/icon.png / icon.icns for the app icon — scaled from
 * its 512-unit box down to this component's 24-unit viewBox. If the mark
 * ever changes, update both this file and brand/tempo-mark.svg together
 * so the app icon and the in-app mark stay in step.
 *
 * Drawn with the accent gradient tokens (not a raster asset) so it tracks
 * both themes.
 */
export default function TempoMark({ className = "size-6" }: { className?: string }) {
  const gradientId = useId();

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="24" x2="24" y2="0">
          <stop offset="0%" stopColor="var(--color-accent)" />
          <stop offset="100%" stopColor="var(--color-accent-secondary)" />
        </linearGradient>
      </defs>
      <rect x="4.98" y="14.57" width="3.24" height="4.03" rx="1.62" fill={`url(#${gradientId})`} opacity="0.5" />
      <rect x="10.38" y="10.00" width="3.24" height="8.60" rx="1.62" fill={`url(#${gradientId})`} opacity="1" />
      <rect x="15.78" y="12.28" width="3.24" height="6.32" rx="1.62" fill={`url(#${gradientId})`} opacity="0.78" />
    </svg>
  );
}
