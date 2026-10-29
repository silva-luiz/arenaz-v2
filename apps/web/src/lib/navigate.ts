/**
 * Full page navigation. A seam of its own because jsdom cannot navigate, so
 * tests replace this module instead of `window.location`.
 */
export function navigate(url: string): void {
  window.location.assign(url);
}
