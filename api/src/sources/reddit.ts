import type { MarketSource, NewsItem } from "./base.js";
import { fetchWithTimeout } from "../lib/http.js";

interface RedditChild {
  data: {
    id: string;
    title: string;
    permalink: string;
    url: string;
    selftext?: string;
    author?: string;
    score?: number;
    num_comments?: number;
    created_utc?: number;
    stickied?: boolean;
    over_18?: boolean;
  };
}

// Curated to the substantive Indian investing communities — deliberately excludes the
// meme-heavy subs so the feed stays signal, not spam.
const SUBS = ["IndiaInvestments", "DalalStreetTalks"];
const MIN_SCORE = 8;

/**
 * Reddit — discussion & retail sentiment from India's serious investing subreddits.
 * Best-effort: Reddit rate-limits datacenter IPs, so this quietly returns nothing when
 * blocked and contributes when run from a normal network.
 */
export class RedditSource implements MarketSource {
  readonly scope = "market" as const;
  readonly name = "reddit_in";
  readonly label = "Reddit · India";
  readonly description =
    "Discussion & retail sentiment from r/IndiaInvestments and r/DalalStreetTalks. Best-effort.";
  readonly tier = 3 as const;
  readonly category = "social" as const;
  readonly enabled = true;

  async fetch(): Promise<NewsItem[]> {
    const out: NewsItem[] = [];
    for (const sub of SUBS) {
      try {
        const r = await fetchWithTimeout(
          `https://www.reddit.com/r/${sub}/hot.json?limit=20&raw_json=1`,
          { timeoutMs: 12_000, headers: { Accept: "application/json" } }
        );
        if (!r.ok) continue;
        const text = await r.text();
        if (text.trimStart().startsWith("<")) continue; // blocked → HTML
        const json = JSON.parse(text) as { data?: { children?: RedditChild[] } };
        for (const child of json.data?.children ?? []) {
          const p = child.data;
          if (p.stickied || p.over_18) continue;
          if ((p.score ?? 0) < MIN_SCORE) continue;
          const created = p.created_utc ? new Date(p.created_utc * 1000) : null;
          out.push({
            source: this.name,
            externalId: `${sub}:${p.id}`,
            title: `[r/${sub}] ${p.title}`,
            url: `https://www.reddit.com${p.permalink}`,
            description:
              (p.selftext ?? "").slice(0, 280) ||
              `${p.score ?? 0} upvotes · ${p.num_comments ?? 0} comments`,
            author: p.author ? `u/${p.author}` : null,
            publishedAt: created,
          });
        }
      } catch (err) {
        console.warn(`[reddit_in] r/${sub}: ${(err as Error).message}`);
      }
    }
    return out;
  }
}
