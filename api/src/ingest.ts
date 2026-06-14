import { and, desc, eq, gte, isNotNull, isNull } from "drizzle-orm";
import { db } from "./db/client.js";
import { articles, customSources, instruments } from "./db/schema.js";
import { instrumentSources, marketSources } from "./sources/registry.js";
import { fetchCustomRss } from "./sources/custom-rss.js";
import type { InstrumentRef, NewsItem } from "./sources/base.js";
import { PER_ENTITY_SCORE_CAP, scoreArticle } from "./ai/analyst.js";
import { maybeFireAlerts } from "./alerts.js";
import { refreshPulse } from "./market/pulse.js";
import { bus } from "./lib/event-bus.js";

// AI dedup looks back this far for "same underlying story".
const DEDUP_WINDOW_MS = 48 * 60 * 60 * 1000;
const DEDUP_CANDIDATE_LIMIT = 12;
const BACKLOG_PER_ENTITY_PER_CYCLE = 6;

function toRef(t: typeof instruments.$inferSelect): InstrumentRef {
  return { id: t.id, symbol: t.symbol, name: t.name, isin: t.isin, bseCode: t.bseCode, sector: t.sector };
}

async function fetchInstrumentBuiltins(ref: InstrumentRef): Promise<NewsItem[]> {
  const settled = await Promise.allSettled(instrumentSources().map((s) => s.fetch(ref)));
  const out: NewsItem[] = [];
  for (const r of settled) if (r.status === "fulfilled") out.push(...r.value);
  return out;
}

/**
 * Persist new items. instrumentId === null means market-wide. We do an explicit
 * existence check (the partial unique indexes are only a backstop) because NULL
 * instrument_id makes a single unique index insufficient for market-wide dedup.
 */
async function persist(instrumentId: number | null, items: NewsItem[]): Promise<number[]> {
  items.sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0));
  const inserted: number[] = [];
  for (const it of items) {
    const dupeWhere =
      instrumentId === null
        ? and(
            isNull(articles.instrumentId),
            eq(articles.source, it.source),
            eq(articles.externalId, it.externalId)
          )
        : and(
            eq(articles.instrumentId, instrumentId),
            eq(articles.source, it.source),
            eq(articles.externalId, it.externalId)
          );
    const existing = await db.select({ id: articles.id }).from(articles).where(dupeWhere).limit(1);
    if (existing.length > 0) continue;

    const row = await db
      .insert(articles)
      .values({
        instrumentId: instrumentId ?? null,
        marketWide: instrumentId === null,
        source: it.source,
        externalId: it.externalId,
        title: it.title.slice(0, 2000),
        url: it.url,
        description: it.description ?? null,
        author: it.author ?? null,
        publishedAt: it.publishedAt ?? null,
      })
      .returning({ id: articles.id });
    if (row[0]) inserted.push(row[0].id);
  }
  return inserted;
}

async function scoreOne(articleId: number): Promise<void> {
  const rows = await db.select().from(articles).where(eq(articles.id, articleId)).limit(1);
  const article = rows[0];
  if (!article || article.scoredAt) return;

  const isMarket = article.marketWide;
  let label = "the Indian market";
  let name: string | null = null;
  if (!isMarket && article.instrumentId !== null) {
    const t = (
      await db.select().from(instruments).where(eq(instruments.id, article.instrumentId)).limit(1)
    )[0];
    if (!t) return;
    label = t.symbol;
    name = t.name;
  }

  // Candidate siblings for AI dedup: recently-scored, non-duplicate items in the same
  // scope (same instrument, or the market-wide pool) within the dedup window.
  const cutoff = new Date(Date.now() - DEDUP_WINDOW_MS);
  const scopeWhere = isMarket
    ? eq(articles.marketWide, true)
    : eq(articles.instrumentId, article.instrumentId!);
  const candidates = await db
    .select({
      id: articles.id,
      title: articles.title,
      thesisImpact: articles.thesisImpact,
      sentiment: articles.sentiment,
    })
    .from(articles)
    .where(and(scopeWhere, isNotNull(articles.scoredAt), isNull(articles.duplicateOf), gte(articles.ingestedAt, cutoff)))
    .orderBy(desc(articles.ingestedAt))
    .limit(DEDUP_CANDIDATE_LIMIT);
  const recentArticles = candidates.filter((c) => c.id !== article.id);

  const result = await scoreArticle({
    mode: isMarket ? "market" : "instrument",
    symbol: label,
    name,
    title: article.title,
    description: article.description,
    source: article.source,
    recentArticles,
  });
  if (!result) return;

  let duplicateOfId: number | null = null;
  if (result.duplicateOfIndex !== null) {
    const target = recentArticles[result.duplicateOfIndex - 1];
    if (target) {
      duplicateOfId = target.id;
      console.log(
        `[dedup] #${article.id} (${label}) → duplicate of #${target.id} ("${article.title.slice(0, 56)}")`
      );
    }
  }

  await db
    .update(articles)
    .set({
      relevance: result.relevance,
      sentiment: result.sentiment,
      category: result.category,
      thesisImpact: result.thesisImpact,
      novelty: result.novelty,
      scoredAt: new Date(),
      duplicateOf: duplicateOfId,
    })
    .where(eq(articles.id, articleId));

  bus.emit("article.scored", { id: articleId });
  if (duplicateOfId === null) void maybeFireAlerts(articleId);
}

function scheduleScoring(ids: number[]): void {
  if (ids.length === 0) return;
  const toScore = ids.slice(0, PER_ENTITY_SCORE_CAP);
  Promise.allSettled(toScore.map(scoreOne)).catch(() => undefined);
}

export async function ingestInstrument(instrumentId: number): Promise<number> {
  const t = (
    await db.select().from(instruments).where(eq(instruments.id, instrumentId)).limit(1)
  )[0];
  if (!t) return 0;
  const items = await fetchInstrumentBuiltins(toRef(t));
  const newIds = await persist(t.id, items);
  await db.update(instruments).set({ lastPolledAt: new Date() }).where(eq(instruments.id, t.id));
  if (newIds.length > 0) {
    bus.emit("articles.new", { instrumentId: t.id, count: newIds.length });
    scheduleScoring(newIds);
  }
  return newIds.length;
}

async function ingestMarket(): Promise<number> {
  // Built-in market-wide sources
  const settled = await Promise.allSettled(marketSources().map((s) => s.fetch()));
  const items: NewsItem[] = [];
  for (const r of settled) if (r.status === "fulfilled") items.push(...r.value);

  // User-added custom RSS feeds (treated as market-wide)
  const customs = await db
    .select()
    .from(customSources)
    .where(and(eq(customSources.enabled, true), eq(customSources.kind, "rss")));
  for (const cs of customs) {
    try {
      items.push(...(await fetchCustomRss(cs.id, cs.configJson)));
      await db
        .update(customSources)
        .set({ lastPolledAt: new Date() })
        .where(eq(customSources.id, cs.id));
    } catch (e) {
      console.warn(`[custom_rss ${cs.id}] ${(e as Error).message}`);
    }
  }

  const newIds = await persist(null, items);
  if (newIds.length > 0) {
    bus.emit("articles.new", { instrumentId: null, count: newIds.length });
    scheduleScoring(newIds);
  }
  return newIds.length;
}

/** Catch-up: score items missed in earlier cycles, bounded per scope. */
async function scoreBacklog(): Promise<void> {
  const ents = await db.select({ id: instruments.id }).from(instruments);
  for (const e of ents) {
    const unscored = await db
      .select({ id: articles.id })
      .from(articles)
      .where(and(eq(articles.instrumentId, e.id), isNull(articles.scoredAt)))
      .orderBy(desc(articles.ingestedAt))
      .limit(BACKLOG_PER_ENTITY_PER_CYCLE);
    if (unscored.length > 0) await Promise.allSettled(unscored.map((u) => scoreOne(u.id)));
  }
  const marketUnscored = await db
    .select({ id: articles.id })
    .from(articles)
    .where(and(eq(articles.marketWide, true), isNull(articles.scoredAt)))
    .orderBy(desc(articles.ingestedAt))
    .limit(BACKLOG_PER_ENTITY_PER_CYCLE * 3);
  if (marketUnscored.length > 0) await Promise.allSettled(marketUnscored.map((u) => scoreOne(u.id)));
}

export async function ingestAll(): Promise<{ instruments: number; newArticles: number }> {
  const rows = await db.select({ id: instruments.id }).from(instruments).orderBy(instruments.id);
  let total = 0;
  for (const { id } of rows) {
    try {
      total += await ingestInstrument(id);
    } catch (e) {
      console.warn(`[ingest] instrument ${id} failed: ${(e as Error).message}`);
    }
    await new Promise((r) => setTimeout(r, 900));
  }
  try {
    total += await ingestMarket();
  } catch (e) {
    console.warn(`[ingest] market failed: ${(e as Error).message}`);
  }
  try {
    await refreshPulse();
  } catch (e) {
    console.warn(`[ingest] pulse refresh failed: ${(e as Error).message}`);
  }
  try {
    await scoreBacklog();
  } catch (e) {
    console.warn(`[ingest] backlog failed: ${(e as Error).message}`);
  }
  return { instruments: rows.length, newArticles: total };
}
