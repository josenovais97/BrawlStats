import { NotFoundBody } from '@/components/i18n/not-found-body';

/*
 * The root 404, which Next also serves for any URL that matches no route at
 * all — not just for `notFound()` calls inside a segment.
 *
 * No `metadata` export: this version only supports that on
 * `global-not-found.js`, and Next already injects `noindex` on anything
 * returning a 404 status, so setting robots here would be redundant anyway.
 *
 * The links are the point. A dead end that only says "not found" wastes the
 * one thing a lost visitor still has, which is the intent that brought them —
 * so the most likely destinations are offered rather than just a way home.
 */
export default function NotFound() {
  return <NotFoundBody />;
}
