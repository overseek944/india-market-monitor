import { Hono } from "hono";
import { eq, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { articles, customSources } from "../db/schema.js";
import { sourceMetas, SOURCE_LABELS } from "../sources/registry.js";

export const sourcesRoute = new Hono();

sourcesRoute.get("/builtin", async (c) => {
  const counts = (await db
    .select({ source: articles.source, n: sql<number>`COUNT(*)` })
    .from(articles)
    .groupBy(articles.source)) as Array<{ source: string; n: number }>;
  const countMap = new Map(counts.map((r) => [r.source, r.n]));
  return c.json(sourceMetas().map((m) => ({ ...m, count: countMap.get(m.name) ?? 0 })));
});

sourcesRoute.get("/labels", async (c) => {
  const rows = await db.select().from(customSources);
  const labels: Record<string, string> = { ...SOURCE_LABELS };
  for (const cs of rows) labels[`custom_rss_${cs.id}`] = `✦ ${cs.name}`;
  return c.json(labels);
});

sourcesRoute.get("/custom", async (c) => {
  const rows = await db.select().from(customSources).orderBy(customSources.createdAt);
  return c.json(rows);
});

sourcesRoute.post("/rss", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  const url = String(body.url ?? "").trim();
  const scope = String(body.scope ?? "all").trim() || "all";
  if (!name || !url) return c.json({ error: "name and url required" }, 400);
  const row = (
    await db
      .insert(customSources)
      .values({ name, kind: "rss", configJson: JSON.stringify({ url }), scope })
      .returning()
  )[0];
  return c.json(row, 201);
});

sourcesRoute.post("/:id/toggle", async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  const row = (await db.select().from(customSources).where(eq(customSources.id, id)).limit(1))[0];
  if (!row) return c.json({ error: "not found" }, 404);
  const enabled = !row.enabled;
  await db.update(customSources).set({ enabled }).where(eq(customSources.id, id));
  return c.json({ ok: true, enabled });
});

sourcesRoute.delete("/:id", async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  await db.delete(customSources).where(eq(customSources.id, id));
  return c.json({ ok: true });
});

export default sourcesRoute;
