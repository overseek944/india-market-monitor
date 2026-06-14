import { sqliteTable, integer, text, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/**
 * An instrument is a single NSE-listed (and usually BSE cross-listed) equity that
 * the user is tracking. The set of instruments IS the watchlist — adding one starts
 * polling it; removing one stops. ISIN is the universal join key between the NSE
 * symbol master and the BSE scrip-code master.
 */
export const instruments = sqliteTable(
  "instruments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    symbol: text("symbol").notNull().unique(), // NSE symbol, e.g. "RELIANCE"
    name: text("name"), // "Reliance Industries Limited"
    isin: text("isin"), // "INE002A01018"
    bseCode: text("bse_code"), // "500325" — needed for BSE announcement API
    sector: text("sector"), // best-effort sector tag
    industry: text("industry"),
    series: text("series"), // NSE series (EQ, BE, ...)
    addedAt: integer("added_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    lastPolledAt: integer("last_polled_at", { mode: "timestamp_ms" }),
  },
  (t) => ({
    symbolIdx: uniqueIndex("ix_instrument_symbol").on(t.symbol),
    isinIdx: index("ix_instrument_isin").on(t.isin),
  })
);

/**
 * Articles. instrumentId is NULL for market-wide items (SEBI / RBI-policy / index
 * commentary) which belong to the Market Pulse feed rather than a single stock.
 * marketWide mirrors that as a boolean for cheap filtering.
 */
export const articles = sqliteTable(
  "articles",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    instrumentId: integer("instrument_id").references(() => instruments.id, {
      onDelete: "cascade",
    }),
    marketWide: integer("market_wide", { mode: "boolean" }).notNull().default(false),
    source: text("source").notNull(),
    externalId: text("external_id").notNull(),
    title: text("title").notNull(),
    url: text("url").notNull(),
    canonicalUrl: text("canonical_url"),
    description: text("description"),
    author: text("author"),
    publishedAt: integer("published_at", { mode: "timestamp_ms" }),
    ingestedAt: integer("ingested_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),

    // AI scoring (nullable; filled async by the local Claude analyst)
    relevance: integer("relevance"),
    sentiment: text("sentiment"),
    category: text("category"),
    thesisImpact: text("thesis_impact"),
    novelty: integer("novelty"),
    scoredAt: integer("scored_at", { mode: "timestamp_ms" }),
    // AI-judged cross-source dedup: points at the canonical article id when Claude
    // decides this reports the same underlying event. Hidden from feed/search/alerts.
    duplicateOf: integer("duplicate_of"),
  },
  (t) => ({
    instPub: index("ix_article_instrument_published").on(t.instrumentId, t.publishedAt),
    marketPub: index("ix_article_market_published").on(t.marketWide, t.publishedAt),
    sourceIdx: index("ix_article_source").on(t.source),
    duplicateOfIdx: index("ix_article_duplicate_of").on(t.duplicateOf),
  })
);

/**
 * Latest snapshot of market-pulse data (indices + FII/DII flows). One row per kind;
 * we upsert the newest payload so the dashboard always reads a single fresh row.
 */
export const marketSnapshots = sqliteTable("market_snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  kind: text("kind").notNull().unique(), // 'indices' | 'fii_dii' | 'breadth'
  dataJson: text("data_json").notNull(),
  capturedAt: integer("captured_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const customSources = sqliteTable("custom_sources", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  kind: text("kind").notNull(), // 'rss'
  configJson: text("config_json").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  scope: text("scope").notNull().default("all"), // 'all' | 'market' | comma list of symbols
  lastPolledAt: integer("last_polled_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const alerts = sqliteTable("alerts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  scope: text("scope").notNull().default("all"), // 'all' | 'market' | comma list of symbols
  minRelevance: integer("min_relevance").notNull().default(7),
  sentimentFilter: text("sentiment_filter"), // null = any
  categoryFilter: text("category_filter"), // null = any, else comma list
  channel: text("channel").notNull(), // 'desktop' | 'webhook' | 'log'
  channelConfig: text("channel_config").notNull().default("{}"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const alertLog = sqliteTable("alert_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  alertId: integer("alert_id")
    .notNull()
    .references(() => alerts.id, { onDelete: "cascade" }),
  articleId: integer("article_id")
    .notNull()
    .references(() => articles.id, { onDelete: "cascade" }),
  firedAt: integer("fired_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  success: integer("success", { mode: "boolean" }).notNull(),
  error: text("error"),
});

export type Instrument = typeof instruments.$inferSelect;
export type NewInstrument = typeof instruments.$inferInsert;
export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;
export type MarketSnapshot = typeof marketSnapshots.$inferSelect;
export type CustomSource = typeof customSources.$inferSelect;
export type NewCustomSource = typeof customSources.$inferInsert;
export type Alert = typeof alerts.$inferSelect;
export type NewAlert = typeof alerts.$inferInsert;
export type AlertLogRow = typeof alertLog.$inferSelect;
