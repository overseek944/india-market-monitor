import Parser from "rss-parser";
import type { InstrumentRef, InstrumentSource, NewsItem } from "./base.js";
import { BROWSER_UA } from "../lib/http.js";

const parser = new Parser({ headers: { "User-Agent": BROWSER_UA } });

/** Strip corporate suffixes so the news query matches headlines, not legal names. */
function cleanName(name: string | null): string | null {
  if (!name) return null;
  const c = name
    .replace(/\b(Limited|Ltd\.?|Private|Pvt\.?|Corporation|Corp\.?|Industries|Company|Co\.?)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return c.length >= 3 ? c : name.trim();
}

/**
 * Google News (India edition). One query per watched stock pulls coverage from across
 * the entire Indian financial press — Moneycontrol, Economic Times, Mint, Business
 * Standard, NDTV Profit, CNBC-TV18, BusinessLine, Reuters, Financial Express — in a
 * single feed. Most of those sites block direct scraping, so this is how we reach them.
 */
export class GoogleNewsSource implements InstrumentSource {
  readonly scope = "instrument" as const;
  readonly name = "google_news_in";
  readonly label = "Google News · India";
  readonly description =
    "Per-stock coverage aggregated from the entire Indian financial press (ET, Mint, Moneycontrol, BS, NDTV Profit, Reuters, BusinessLine…).";
  readonly tier = 2 as const;
  readonly category = "news" as const;
  readonly enabled = true;

  async fetch(inst: InstrumentRef): Promise<NewsItem[]> {
    const name = cleanName(inst.name);
    const parts: string[] = [];
    if (name) parts.push(`"${name}"`);
    parts.push(`"${inst.symbol} share"`);
    const query = `(${parts.join(" OR ")}) when:7d`;
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(
      query
    )}&hl=en-IN&gl=IN&ceid=IN:en`;

    try {
      const feed = await parser.parseURL(url);
      const items: NewsItem[] = [];
      for (const e of feed.items) {
        let title = (e.title ?? "").trim();
        const link = e.link ?? "";
        if (!title || !link) continue;
        const externalId = String(e.guid ?? e.id ?? link);

        // Google appends " - <Publisher>" to titles
        let author: string | null = null;
        const hyphenIdx = title.lastIndexOf(" - ");
        if (hyphenIdx > 0) {
          author = title.slice(hyphenIdx + 3);
          title = title.slice(0, hyphenIdx);
        }

        let publishedAt: Date | null = null;
        const ds = e.isoDate ?? e.pubDate;
        if (ds) {
          const d = new Date(ds);
          if (!Number.isNaN(d.getTime())) publishedAt = d;
        }

        items.push({
          source: this.name,
          externalId,
          title,
          url: link,
          description: e.contentSnippet ?? null,
          author,
          publishedAt,
        });
      }
      return items;
    } catch (err) {
      console.warn(`[google_news_in] ${inst.symbol}: ${(err as Error).message}`);
      return [];
    }
  }
}
