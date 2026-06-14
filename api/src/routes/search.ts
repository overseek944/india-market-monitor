import { Hono } from "hono";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { articles, instruments } from "../db/schema.js";

export const searchRoute = new Hono();

searchRoute.get("/", async (c) => {
  const q = (c.req.query("q") ?? "").trim();
  if (!q) return c.json({ items: [], query: q });

  // Build a safe FTS5 prefix query: alphanumeric tokens, each prefix-matched.
  const terms = q
    .split(/\s+/)
    .map((t) => t.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean);
  if (terms.length === 0) return c.json({ items: [], query: q });
  const ftsQuery = terms.map((t) => `${t}*`).join(" ");

  const matchSubquery = sql`${articles.id} IN (SELECT rowid FROM articles_fts WHERE articles_fts MATCH ${ftsQuery})`;

  const rows = await db
    .select({ article: articles, instrument: instruments })
    .from(articles)
    .leftJoin(instruments, eq(articles.instrumentId, instruments.id))
    .where(and(isNull(articles.duplicateOf), matchSubquery))
    .orderBy(desc(sql`COALESCE(${articles.publishedAt}, ${articles.ingestedAt})`))
    .limit(120);

  return c.json({ items: rows.map((r) => ({ article: r.article, instrument: r.instrument })), query: q });
});

export default searchRoute;
