import Parser from "rss-parser";
import type { MarketSource, NewsItem } from "./base.js";
import { BROWSER_UA } from "../lib/http.js";

const parser = new Parser({ headers: { "User-Agent": BROWSER_UA }, timeout: 15_000 });

/**
 * Macro Radar — the top-down signals that move the whole tape but belong to no single
 * stock: RBI policy & rates, inflation prints, FII/DII flows, the rupee and crude, and
 * Budget/fiscal news. Sourced via curated Google News (India) queries because RBI's own
 * feed blocks programmatic access. These land in the Market Pulse feed.
 */
const QUERIES: Array<{ q: string; tag: string }> = [
  { q: "RBI monetary policy OR repo rate OR MPC India", tag: "RBI/Rates" },
  { q: "India inflation CPI OR WPI OR IIP data", tag: "Macro Data" },
  { q: "FII DII flows India equity OR foreign investors", tag: "Flows" },
  { q: "rupee dollar OR crude oil impact Indian market", tag: "FX/Commodities" },
  { q: "Union Budget OR fiscal deficit OR GST collection India", tag: "Fiscal" },
];

export class MacroRadarSource implements MarketSource {
  readonly scope = "market" as const;
  readonly name = "macro_radar";
  readonly label = "Macro Radar";
  readonly description =
    "Top-down market drivers — RBI policy & rates, inflation, FII/DII flows, rupee/crude, fiscal news.";
  readonly tier = 2 as const;
  readonly category = "macro" as const;
  readonly enabled = true;

  async fetch(): Promise<NewsItem[]> {
    const seen = new Set<string>();
    const out: NewsItem[] = [];
    for (const { q, tag } of QUERIES) {
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(
        `${q} when:3d`
      )}&hl=en-IN&gl=IN&ceid=IN:en`;
      try {
        const feed = await parser.parseURL(url);
        for (const e of feed.items.slice(0, 8)) {
          let title = (e.title ?? "").trim();
          const link = e.link ?? "";
          if (!title || !link) continue;
          const key = String(e.guid ?? link);
          if (seen.has(key)) continue;
          seen.add(key);

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
          out.push({
            source: this.name,
            externalId: key,
            title: `[${tag}] ${title}`,
            url: link,
            description: e.contentSnippet ?? null,
            author,
            publishedAt,
          });
        }
      } catch (err) {
        console.warn(`[macro_radar] "${tag}" failed: ${(err as Error).message}`);
      }
    }
    return out;
  }
}
