import { Hono } from "hono";
import { and, eq, isNull, isNotNull, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { articles, instruments } from "../db/schema.js";
import { isAiEnabled } from "../ai/analyst.js";

export const statsRoute = new Hono();

statsRoute.get("/", async (c) => {
  const [{ n: instrumentCount }] = await db
    .select({ n: sql<number>`COUNT(*)` })
    .from(instruments);
  const [{ n: articleCount }] = await db
    .select({ n: sql<number>`COUNT(*)` })
    .from(articles)
    .where(isNull(articles.duplicateOf));
  const [{ n: scoredCount }] = await db
    .select({ n: sql<number>`COUNT(*)` })
    .from(articles)
    .where(and(isNull(articles.duplicateOf), isNotNull(articles.scoredAt)));
  const [{ n: marketCount }] = await db
    .select({ n: sql<number>`COUNT(*)` })
    .from(articles)
    .where(and(isNull(articles.duplicateOf), eq(articles.marketWide, true)));

  return c.json({
    instruments: instrumentCount ?? 0,
    articles: articleCount ?? 0,
    scored: scoredCount ?? 0,
    marketWide: marketCount ?? 0,
    aiEnabled: await isAiEnabled(),
    pollInterval: parseInt(process.env.POLL_INTERVAL_SECONDS ?? "300", 10),
  });
});

export default statsRoute;
