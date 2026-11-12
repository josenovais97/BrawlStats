/**
 * Tell the top bar a navigation is starting (2026-11-12), for code that moves
 * with `router.push` after cancelling a form submit or a click: those never
 * reach the link and form listeners in components/feedback/nav-feedback.
 * Pass the element that was used to mark it as loading too.
 */
export function navStart(el?: Element | null): void {
  if (typeof window === 'undefined') return;
  el?.setAttribute('data-pending', '');
  window.dispatchEvent(new Event('bz:navstart'));
}
