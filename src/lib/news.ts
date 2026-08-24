import 'server-only';
import { USER_AGENT } from '@/lib/site';

/**
 * Official Brawl Stars news, read from Supercell's own blog.
 *
 * There is no RSS feed and no public API, but the page is a Next.js app that
 * embeds its data as JSON in a `__NEXT_DATA__` script tag. Parsing that is far
 * more robust than scraping rendered markup — it is the same payload the page
 * hydrates from, with real titles, categories, dates and thumbnails.
 *
 * It is still someone else's private structure and can change without notice,
 * so every failure degrades to an empty list and the page simply omits the
 * section rather than erroring.
 */

const BLOG_URL = 'https://supercell.com/en/games/brawlstars/blog/';
const BLOG_ORIGIN = 'https://supercell.com';

/** News changes a few times a month; hourly is plenty and stays polite. */
const REVALIDATE_NEWS = 3600;

export interface NewsPost {
  title: string;
  category: string | null;
  url: string;
  publishedAt: string | null;
  imageUrl: string | null;
}

/** Shape of the entries inside `props.pageProps.articles`. */
interface RawArticle {
  title?: unknown;
  category?: unknown;
  linkUrl?: unknown;
  publishDate?: unknown;
  thumbnail?: { imgUrl?: unknown } | null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export async function getOfficialNews(limit = 6): Promise<NewsPost[]> {
  let html: string;

  try {
    const res = await fetch(BLOG_URL, {
      headers: {
        // Identify ourselves rather than pretending to be a browser.
        'User-Agent': USER_AGENT,
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(10_000),
      next: { revalidate: REVALIDATE_NEWS },
    });
    if (!res.ok) return [];
    html = await res.text();
  } catch {
    return [];
  }

  try {
    const match = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html);
    if (!match) return [];

    const data = JSON.parse(match[1]) as {
      props?: { pageProps?: { articles?: RawArticle[] } };
    };

    const articles = data.props?.pageProps?.articles;
    if (!Array.isArray(articles)) return [];

    return articles
      .map((article): NewsPost | null => {
        const title = asString(article.title);
        const link = asString(article.linkUrl);
        if (!title || !link) return null;

        return {
          title,
          category: asString(article.category),
          url: link.startsWith('http') ? link : `${BLOG_ORIGIN}${link}`,
          publishedAt: asString(article.publishDate),
          imageUrl: asString(article.thumbnail?.imgUrl),
        };
      })
      .filter((post): post is NewsPost => post !== null)
      .slice(0, limit);
  } catch {
    return [];
  }
}
