import Parser from "rss-parser";
import type { NewsItem } from "./base.js";
import { BROWSER_UA } from "../lib/http.js";

const parser = new Parser({ headers: { "User-Agent": BROWSER_UA }, timeout: 15_000 });

export interface CustomRssConfig {
  url: string;
}

export function parseConfig(json: string): CustomRssConfig {
  try {
    const c = JSON.parse(json) as CustomRssConfig;
    return { url: c.url ?? "" };
  } catch {
    return { url: "" };
  }
}

/**
 * User-added RSS feed (e.g. a favourite analyst's Substack, a sector blog, a broker's
 * research feed). Treated as a market-wide source so it lands in the Pulse feed and is
 * AI-scored for relevance like everything else.
 */
export async function fetchCustomRss(sourceId: number, configJson: string): Promise<NewsItem[]> {
  const cfg = parseConfig(configJson);
  if (!cfg.url) return [];
  const sourceName = `custom_rss_${sourceId}`;
  try {
    const feed = await parser.parseURL(cfg.url);
    const items: NewsItem[] = [];
    for (const e of feed.items.slice(0, 40)) {
      const title = (e.title ?? "").trim();
      const link = e.link ?? "";
      if (!title || !link) continue;
      let publishedAt: Date | null = null;
      const ds = e.isoDate ?? e.pubDate;
      if (ds) {
        const d = new Date(ds);
        if (!Number.isNaN(d.getTime())) publishedAt = d;
      }
      items.push({
        source: sourceName,
        externalId: String(e.guid ?? e.id ?? link),
        title,
        url: link,
        description: e.contentSnippet ?? e.content ?? null,
        author: (e.creator as string | undefined) ?? null,
        publishedAt,
      });
    }
    return items;
  } catch (err) {
    console.warn(`[custom_rss ${sourceId}] ${(err as Error).message}`);
    return [];
  }
}
