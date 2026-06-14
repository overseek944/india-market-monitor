import { Hono } from "hono";
import { and, desc, eq, gte, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { articles, instruments } from "../db/schema.js";

export const feedRoute = new Hono();

const PUBLISHED_OR_INGESTED = sql`COALESCE(${articles.publishedAt}, ${articles.ingestedAt})`;

feedRoute.get("/", async (c) => {
  const q = c.req.query();
  const scope = (q.scope ?? "instrument") as "instrument" | "market" | "all";
  const limit = Math.min(parseInt(q.limit ?? "300", 10) || 300, 800);

  const conds = [isNull(articles.duplicateOf)];

  if (scope === "instrument") conds.push(isNotNull(articles.instrumentId));
  else if (scope === "market") conds.push(eq(articles.marketWide, true));

  if (q.symbol) conds.push(eq(instruments.symbol, q.symbol.toUpperCase()));
  if (q.symbols) {
    const list = q.symbols.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
    if (list.length) conds.push(inArray(instruments.symbol, list));
  }
  if (q.source) conds.push(eq(articles.source, q.source));
  if (q.sources) {
    const list = q.sources.split(",").map((s) => s.trim()).filter(Boolean);
    if (list.length) conds.push(inArray(articles.source, list));
  }
  if (q.categories) {
    const list = q.categories.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (list.length) conds.push(inArray(articles.category, list));
  }
  const minRel = parseInt(q.min_relevance ?? "0", 10) || 0;
  if (minRel > 0) conds.push(gte(articles.relevance, minRel));
  if (q.sentiment) conds.push(eq(articles.sentiment, q.sentiment));
  if (q.since_ms) {
    const since = parseInt(q.since_ms, 10);
    if (Number.isFinite(since)) conds.push(sql`${PUBLISHED_OR_INGESTED} >= ${since}`);
  }
  // Purist mode (instrument scope only): hide pre-add backfill.
  if (scope === "instrument" && q.include_backfill !== "1") {
    conds.push(sql`${PUBLISHED_OR_INGESTED} >= ${instruments.addedAt}`);
  }

  const sort = q.sort ?? "newest";
  const orderBy =
    sort === "relevance"
      ? [desc(articles.relevance), desc(PUBLISHED_OR_INGESTED)]
      : sort === "novelty"
        ? [desc(articles.novelty), desc(PUBLISHED_OR_INGESTED)]
        : sort === "oldest"
          ? [sql`${PUBLISHED_OR_INGESTED} ASC`]
          : [desc(PUBLISHED_OR_INGESTED)];

  const rows = await db
    .select({ article: articles, instrument: instruments })
    .from(articles)
    .leftJoin(instruments, eq(articles.instrumentId, instruments.id))
    .where(and(...conds))
    .orderBy(...orderBy)
    .limit(limit);

  return c.json({
    items: rows.map((r) => ({ article: r.article, instrument: r.instrument })),
    scope,
    includeBackfill: q.include_backfill === "1",
  });
});

// Category facet counts for the active scope (for filter chips).
feedRoute.get("/categories", async (c) => {
  const scope = c.req.query("scope") ?? "instrument";
  const scopeCond =
    scope === "market"
      ? eq(articles.marketWide, true)
      : scope === "instrument"
        ? isNotNull(articles.instrumentId)
        : sql`1=1`;
  const rows = await db
    .select({ category: articles.category, n: sql<number>`COUNT(*)` })
    .from(articles)
    .where(and(isNull(articles.duplicateOf), isNotNull(articles.category), scopeCond))
    .groupBy(articles.category)
    .orderBy(desc(sql`COUNT(*)`));
  return c.json(rows);
});

export default feedRoute;
