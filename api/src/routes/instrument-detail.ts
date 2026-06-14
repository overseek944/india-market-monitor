import { Hono } from "hono";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { articles, instruments } from "../db/schema.js";

export const instrumentDetailRoute = new Hono();

instrumentDetailRoute.get("/:symbol", async (c) => {
  const symbol = c.req.param("symbol").toUpperCase();
  const inst = (
    await db.select().from(instruments).where(eq(instruments.symbol, symbol)).limit(1)
  )[0];
  if (!inst) return c.json({ error: "not found" }, 404);

  const baseWhere = and(eq(articles.instrumentId, inst.id), isNull(articles.duplicateOf));

  const timeline = await db
    .select()
    .from(articles)
    .where(baseWhere)
    .orderBy(desc(sql`COALESCE(${articles.publishedAt}, ${articles.ingestedAt})`))
    .limit(60);

  const top = await db
    .select()
    .from(articles)
    .where(baseWhere)
    .orderBy(desc(articles.relevance), desc(sql`COALESCE(${articles.publishedAt}, ${articles.ingestedAt})`))
    .limit(8);

  const sourceBreakdown = (await db
    .select({ source: articles.source, n: sql<number>`COUNT(*)` })
    .from(articles)
    .where(baseWhere)
    .groupBy(articles.source)
    .orderBy(desc(sql`COUNT(*)`))) as Array<{ source: string; n: number }>;

  const categoryBreakdown = (await db
    .select({ category: articles.category, n: sql<number>`COUNT(*)` })
    .from(articles)
    .where(baseWhere)
    .groupBy(articles.category)
    .orderBy(desc(sql`COUNT(*)`))) as Array<{ category: string | null; n: number }>;

  // 30-day sentiment trend.
  const trendRows = (await db.all(sql`
    SELECT strftime('%Y-%m-%d', COALESCE(published_at, ingested_at) / 1000, 'unixepoch') AS day,
      SUM(CASE WHEN sentiment = 'bullish' THEN 1 ELSE 0 END) AS bullish,
      SUM(CASE WHEN sentiment = 'bearish' THEN 1 ELSE 0 END) AS bearish,
      SUM(CASE WHEN sentiment = 'neutral' OR sentiment IS NULL THEN 1 ELSE 0 END) AS neutral,
      COUNT(*) AS total
    FROM articles
    WHERE instrument_id = ${inst.id} AND duplicate_of IS NULL
    GROUP BY day ORDER BY day DESC LIMIT 30
  `)) as Array<{ day: string; bullish: number; bearish: number; neutral: number; total: number }>;

  return c.json({
    instrument: inst,
    timeline,
    top,
    sourceBreakdown,
    categoryBreakdown,
    trend: trendRows.reverse(),
  });
});

export default instrumentDetailRoute;
