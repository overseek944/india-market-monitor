import { Hono } from "hono";
import { desc, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { alerts, alertLog, articles, instruments } from "../db/schema.js";

export const alertsRoute = new Hono();

alertsRoute.get("/", async (c) => {
  const rows = await db.select().from(alerts).orderBy(desc(alerts.createdAt));
  return c.json(rows);
});

alertsRoute.post("/", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  if (!name) return c.json({ error: "name required" }, 400);
  const channel = ["desktop", "webhook", "log"].includes(body.channel) ? body.channel : "desktop";
  const channelConfig = body.webhookUrl ? JSON.stringify({ url: String(body.webhookUrl) }) : "{}";
  const row = (
    await db
      .insert(alerts)
      .values({
        name,
        scope: String(body.scope ?? "all") || "all",
        minRelevance: Number.isFinite(body.minRelevance) ? body.minRelevance : 7,
        sentimentFilter: body.sentimentFilter || null,
        categoryFilter: body.categoryFilter || null,
        channel,
        channelConfig,
      })
      .returning()
  )[0];
  return c.json(row, 201);
});

alertsRoute.post("/:id/toggle", async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  const row = (await db.select().from(alerts).where(eq(alerts.id, id)).limit(1))[0];
  if (!row) return c.json({ error: "not found" }, 404);
  const enabled = !row.enabled;
  await db.update(alerts).set({ enabled }).where(eq(alerts.id, id));
  return c.json({ ok: true, enabled });
});

alertsRoute.delete("/:id", async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  await db.delete(alerts).where(eq(alerts.id, id));
  return c.json({ ok: true });
});

// Inbox: recent fires joined with their alert + article + instrument.
alertsRoute.get("/log", async (c) => {
  const rows = await db
    .select({ log: alertLog, alert: alerts, article: articles, instrument: instruments })
    .from(alertLog)
    .innerJoin(alerts, eq(alertLog.alertId, alerts.id))
    .innerJoin(articles, eq(alertLog.articleId, articles.id))
    .leftJoin(instruments, eq(articles.instrumentId, instruments.id))
    .orderBy(desc(alertLog.firedAt))
    .limit(200);
  return c.json({ items: rows });
});

export default alertsRoute;
