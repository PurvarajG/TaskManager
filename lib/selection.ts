/**
 * A drag-select that starts and ends inside a clickable element still fires
 * a click in Chromium — text selection doesn't cancel it the way starting an
 * HTML5 drag does. Title buttons carry select-text so task titles can be
 * copied, so their click handlers check this first and skip the click's
 * normal action when the mouseup left behind a real selection.
 */
export function hasTextSelection(): boolean {
  const selection = window.getSelection();
  return !!selection && selection.toString().length > 0;
}
