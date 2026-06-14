import type { InstrumentSource, MarketSource, Source } from "./base.js";
import { isInstrumentSource, isMarketSource } from "./base.js";
import { NseAnnouncementsSource } from "./nse-announcements.js";
import { NseInsiderSource } from "./nse-insider.js";
import { BseAnnouncementsSource } from "./bse-announcements.js";
import { GoogleNewsSource } from "./google-news.js";
import { SebiSource } from "./sebi.js";
import { MacroRadarSource } from "./macro-radar.js";
import { RedditSource } from "./reddit.js";
import { RssMarketSource } from "./rss-market.js";

/** Every built-in source, ordered by signal tier. */
export function allSources(): Source[] {
  return [
    // ── Tier 1 · official / regulatory — the hard signal ───────────────────
    new NseAnnouncementsSource(),
    new BseAnnouncementsSource(),
    new NseInsiderSource(),
    new SebiSource(),

    // ── Tier 2 · quality press & macro ─────────────────────────────────────
    new GoogleNewsSource(),
    new MacroRadarSource(),
    new RssMarketSource({
      name: "et_markets",
      label: "Economic Times · Markets",
      description: "India's largest financial daily — live markets desk.",
      url: "https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms",
      tier: 2,
      category: "news",
      badge: "[ET]",
    }),
    new RssMarketSource({
      name: "livemint_markets",
      label: "Mint · Markets",
      description: "HT Mint markets coverage and analysis.",
      url: "https://www.livemint.com/rss/markets",
      tier: 2,
      category: "news",
      badge: "[Mint]",
    }),
    new RssMarketSource({
      name: "businessline_markets",
      label: "BusinessLine · Markets",
      description: "The Hindu BusinessLine markets desk.",
      url: "https://www.thehindubusinessline.com/markets/feeder/default.rss",
      tier: 2,
      category: "news",
      badge: "[BL]",
    }),

    // ── Tier 3 · social / sentiment ────────────────────────────────────────
    new RedditSource(),
  ];
}

export function instrumentSources(): InstrumentSource[] {
  return allSources().filter(isInstrumentSource).filter((s) => s.enabled);
}

export function marketSources(): MarketSource[] {
  return allSources().filter(isMarketSource).filter((s) => s.enabled);
}

export interface SourceMeta {
  name: string;
  label: string;
  description: string;
  tier: number;
  category: string;
  scope: "instrument" | "market";
  enabled: boolean;
}

export function sourceMetas(): SourceMeta[] {
  return allSources().map((s) => ({
    name: s.name,
    label: s.label,
    description: s.description,
    tier: s.tier,
    category: s.category,
    scope: s.scope,
    enabled: s.enabled,
  }));
}

export const SOURCE_LABELS: Record<string, string> = Object.fromEntries(
  allSources().map((s) => [s.name, s.label])
);
