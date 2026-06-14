import Parser from "rss-parser";
import type { MarketSource, NewsItem, SourceCategory, SourceTier } from "./base.js";
import { BROWSER_UA } from "../lib/http.js";

const parser = new Parser({ headers: { "User-Agent": BROWSER_UA }, timeout: 15_000 });

export interface RssMarketConfig {
  name: string;
  label: string;
  description: string;
  url: string;
  tier: SourceTier;
  category: SourceCategory;
  enabled?: boolean;
  /** Optional prefix added to titles (e.g. "[Mint]"). */
  badge?: string;
  limit?: number;
}

/**
 * Generic market-wide RSS source. Used for the fresh, scrape-friendly financial dailies
 * (Economic Times, Mint, BusinessLine). The famously bot-blocked outlets (Moneycontrol,
 * NDTV Profit, Business Standard) are reached per-stock through Google News instead.
 */
export class RssMarketSource implements MarketSource {
  readonly scope = "market" as const;
  readonly name: string;
  readonly label: string;
  readonly description: string;
  readonly tier: SourceTier;
  readonly category: SourceCategory;
  readonly enabled: boolean;
  private readonly url: string;
  private readonly badge: string;
  private readonly limit: number;

  constructor(cfg: RssMarketConfig) {
    this.name = cfg.name;
    this.label = cfg.label;
    this.description = cfg.description;
    this.url = cfg.url;
    this.tier = cfg.tier;
    this.category = cfg.category;
    this.enabled = cfg.enabled ?? true;
    this.badge = cfg.badge ?? "";
    this.limit = cfg.limit ?? 40;
  }

  async fetch(): Promise<NewsItem[]> {
    try {
      const feed = await parser.parseURL(this.url);
      const items: NewsItem[] = [];
      for (const e of feed.items.slice(0, this.limit)) {
        const title = (e.title ?? "").trim();
        const link = e.link ?? "";
        if (!title || !link) continue;
        const externalId = String(e.guid ?? e.id ?? link);
        let publishedAt: Date | null = null;
        const ds = e.isoDate ?? e.pubDate;
        if (ds) {
          const d = new Date(ds);
          if (!Number.isNaN(d.getTime())) publishedAt = d;
        }
        items.push({
          source: this.name,
          externalId,
          title: this.badge ? `${this.badge} ${title}` : title,
          url: link,
          description: e.contentSnippet ?? e.content ?? null,
          author: (e.creator as string | undefined) ?? null,
          publishedAt,
        });
      }
      return items;
    } catch (err) {
      console.warn(`[${this.name}] fetch failed: ${(err as Error).message}`);
      return [];
    }
  }
}
