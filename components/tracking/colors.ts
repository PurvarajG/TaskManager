/**
 * Categories store a theme token name ("cat-indigo"), never a hex value, so
 * recolouring the theme recolours every category using it — see the
 * `--color-cat-*` tokens in app/globals.css. This turns that stored name into
 * the CSS custom property reference every tracking primitive renders from.
 */
export function categoryColorVar(token: string): string {
  return `var(--color-${token})`;
}

export function categoryTint(token: string, percent: number): string {
  return `color-mix(in srgb, ${categoryColorVar(token)} ${percent}%, transparent)`;
}
