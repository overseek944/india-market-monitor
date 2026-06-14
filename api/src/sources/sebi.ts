import Parser from "rss-parser";
import type { MarketSource, NewsItem } from "./base.js";
import { BROWSER_UA } from "../lib/http.js";
import { parseIstDate } from "../lib/dates.js";

const parser = new Parser({ headers: { "User-Agent": BROWSER_UA }, timeout: 15_000 });

/**
 * SEBI RSS — orders, circulars, settlement & prohibitory orders, and press releases
 * straight from the market regulator. Enforcement actions and rule changes move sectors
 * and individual names; this is the regulator's own primary feed.
 */
export class SebiSource implements MarketSource {
  readonly scope = "market" as const;
  readonly name = "sebi";
  readonly label = "SEBI · Regulator";
  readonly description =
    "Orders, circulars, settlement & prohibitory orders and press releases direct from SEBI.";
  readonly tier = 1 as const;
  readonly category = "regulatory" as const;
  readonly enabled = true;

  async fetch(): Promise<NewsItem[]> {
    try {
      const feed = await parser.parseURL("https://www.sebi.gov.in/sebirss.xml");
      const items: NewsItem[] = [];
      for (const e of feed.items.slice(0, 40)) {
        const title = (e.title ?? "").trim();
        const link = e.link ?? "";
        if (!title || !link) continue;
        const externalId = String(e.guid ?? e.id ?? link);
        const publishedAt =
          (e.isoDate ? new Date(e.isoDate) : null) ?? parseIstDate(e.pubDate ?? null);
        items.push({
          source: this.name,
          externalId,
          title: `[SEBI] ${title}`,
          url: link,
          description: e.contentSnippet ?? null,
          publishedAt: publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : null,
        });
      }
      return items;
    } catch (err) {
      console.warn(`[sebi] fetch failed: ${(err as Error).message}`);
      return [];
    }
  }
}
