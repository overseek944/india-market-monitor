import { Hono } from "hono";
import { eq, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { articles, customSources } from "../db/schema.js";
import { sourceMetas, SOURCE_LABELS } from "../sources/registry.js";
import { testImap, type ImapConfig } from "../sources/custom-imap.js";

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
  for (const cs of rows) {
    const icon = cs.kind === "imap" ? "✉" : "✦";
    labels[`custom_${cs.kind}_${cs.id}`] = `${icon} ${cs.name}`;
  }
  return c.json(labels);
});

sourcesRoute.get("/custom", async (c) => {
  const rows = await db.select().from(customSources).orderBy(customSources.createdAt);
  // Never expose stored IMAP passwords to the client.
  for (const r of rows) {
    if (r.kind === "imap") {
      try {
        const cfg = JSON.parse(r.configJson);
        r.configJson = JSON.stringify({ ...cfg, password: cfg.password ? "***" : "" });
      } catch {
        /* leave as-is */
      }
    }
  }
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

function imapConfigFromBody(body: Record<string, unknown>): ImapConfig {
  return {
    host: String(body.host ?? "").trim(),
    port: Number(body.port) || 993,
    username: String(body.username ?? "").trim(),
    password: String(body.password ?? ""),
    folder: String(body.folder ?? "INBOX").trim() || "INBOX",
    tls: body.tls === undefined ? true : Boolean(body.tls),
  };
}

// Test IMAP credentials without saving — used by the "Test connection" button.
sourcesRoute.post("/imap/test", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const cfg = imapConfigFromBody(body);
  const res = await testImap(JSON.stringify(cfg));
  return c.json(res, res.ok ? 200 : 400);
});

sourcesRoute.post("/imap", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  const cfg = imapConfigFromBody(body);
  const scope = String(body.scope ?? "all").trim() || "all";
  if (!name || !cfg.host || !cfg.username || !cfg.password) {
    return c.json({ error: "name, host, username and password are required" }, 400);
  }
  const row = (
    await db
      .insert(customSources)
      .values({ name, kind: "imap", configJson: JSON.stringify(cfg), scope })
      .returning()
  )[0];
  // Don't leak the stored password back to the client.
  if (row) row.configJson = JSON.stringify({ ...cfg, password: "***" });
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
