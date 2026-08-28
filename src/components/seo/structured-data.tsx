import { SITE_NAME, SITE_URL } from "@/lib/site";

/**
 * Schema.org payloads, emitted as JSON-LD.
 *
 * Everything passed in is built on the server from our own data, never from a
 * query string, so `JSON.stringify` into a script tag is the whole escaping
 * story. The one hostile character in that position is `<` inside a string,
 * which would close the tag early — it is escaped below rather than trusted.
 */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}

/**
 * Trail of ancestors for the current page, ending at the page itself.
 *
 * Google renders this in place of the raw URL in results, which is worth more
 * on a deep path like a map page than on a top-level one — a reader scanning
 * results sees "Maps › Gem Grab › Hard Rock Mine" rather than a slug.
 */
export function breadcrumbSchema(trail: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  };
}

/**
 * An ordered list of things, for pages whose whole point is the ordering —
 * tier lists and best-pick pages.
 */
export function itemListSchema(
  name: string,
  description: string,
  items: { name: string; path: string }[],
) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    description,
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      url: `${SITE_URL}${item.path}`,
    })),
  };
}

/**
 * Questions and answers a page genuinely answers in its own copy.
 *
 * Only ever built from text the page also renders. A FAQ block that exists
 * solely in the markup is the thing Google demotes sites for, and it would
 * also be a lie to the reader.
 */
export function faqSchema(entries: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: entries.map((entry) => ({
      "@type": "Question",
      name: entry.question,
      acceptedAnswer: { "@type": "Answer", text: entry.answer },
    })),
  };
}

/** Wraps a dataset-backed page so the numbers are attributed to the site. */
export function datasetSchema(name: string, description: string, path: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name,
    description,
    url: `${SITE_URL}${path}`,
    creator: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    isAccessibleForFree: true,
  };
}
