import { clientDict } from '@/lib/client-dict';
import { requestLocale } from '@/lib/request-locale';
import { makeT, type T } from '@/lib/t-core';

/**
 * `t` for components rendered on both sides -- icons, headings, the bits a
 * client component imports from a server one. They cannot use `useT` (a hook)
 * or `getT` (it carries the whole site's text into the browser), so they read
 * the small client dictionary and the language from `requestLocale`, which
 * agrees on both sides. Their text belongs in `i18n/client/<lang>.ts`.
 */
export function getUT(): T {
  const locale = requestLocale();
  return makeT(clientDict(locale));
}
