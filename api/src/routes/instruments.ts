import { Hono } from "hono";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { articles, instruments } from "../db/schema.js";
import { lookupInstrument, searchInstruments } from "../lib/instruments-master.js";
import { ingestInstrument } from "../ingest.js";
import { bus } from "../lib/event-bus.js";

export const instrumentsRoute = new Hono();

instrumentsRoute.get("/", async (c) => {
  const counts = await db
    .select({ instrumentId: articles.instrumentId, n: sql<number>`COUNT(*)` })
    .from(articles)
    .where(isNull(articles.duplicateOf))
    .groupBy(articles.instrumentId);
  const countMap = new Map(counts.map((r) => [r.instrumentId, r.n]));

  const rows = await db.select().from(instruments).orderBy(instruments.symbol);
  return c.json(
    rows.map((r) => ({ ...r, articleCount: countMap.get(r.id) ?? 0 }))
  );
});

instrumentsRoute.get("/search", async (c) => {
  const query = c.req.query("q") ?? "";
  const hits = await searchInstruments(query, 12);
  const existing = await db.select({ symbol: instruments.symbol }).from(instruments);
  const have = new Set(existing.map((e) => e.symbol));
  return c.json(
    hits.map((h) => ({
      symbol: h.symbol,
      name: h.name,
      isin: h.isin,
      sector: h.sector,
      alreadyAdded: have.has(h.symbol),
    }))
  );
});

async function addOne(symbolRaw: string): Promise<{ status: "added" | "exists" | "unknown"; instrument?: typeof instruments.$inferSelect }> {
  const symbol = symbolRaw.trim().toUpperCase();
  if (!symbol) return { status: "unknown" };
  const existing = await db.select().from(instruments).where(eq(instruments.symbol, symbol)).limit(1);
  if (existing[0]) return { status: "exists", instrument: existing[0] };

  const master = await lookupInstrument(symbol);
  if (!master) return { status: "unknown" };

  const row = (
    await db
      .insert(instruments)
      .values({
        symbol: master.symbol,
        name: master.name,
        isin: master.isin,
        bseCode: master.bseCode,
        sector: master.sector,
        industry: master.industry,
        series: master.series,
      })
      .returning()
  )[0]!;
  bus.emit("instrument.added", { id: row.id, symbol: row.symbol });
  // Kick an immediate fetch so the feed isn't empty while waiting for the next cycle.
  void ingestInstrument(row.id).catch(() => undefined);
  return { status: "added", instrument: row };
}

instrumentsRoute.post("/", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const symbol = String(body.symbol ?? "");
  const res = await addOne(symbol);
  if (res.status === "unknown") {
    return c.json({ error: `Unknown NSE symbol "${symbol.toUpperCase()}"` }, 404);
  }
  return c.json(res.instrument, res.status === "added" ? 201 : 200);
});

instrumentsRoute.post("/bulk", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const symbols: string[] = Array.isArray(body.symbols) ? body.symbols : [];
  const added: string[] = [];
  const skipped: string[] = [];
  const notFound: string[] = [];
  for (const s of symbols) {
    const res = await addOne(String(s));
    if (res.status === "added") added.push(res.instrument!.symbol);
    else if (res.status === "exists") skipped.push(String(s).toUpperCase());
    else notFound.push(String(s).toUpperCase());
  }
  return c.json({ added, skipped, notFound });
});

instrumentsRoute.delete("/:id", async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  await db.delete(instruments).where(eq(instruments.id, id));
  bus.emit("instrument.removed", { id });
  return c.json({ ok: true });
});

// Sectors present in the watchlist, with instrument counts — powers sidebar grouping.
instrumentsRoute.get("/sectors", async (c) => {
  const rows = await db
    .select({ sector: instruments.sector, n: sql<number>`COUNT(*)` })
    .from(instruments)
    .groupBy(instruments.sector)
    .orderBy(desc(sql`COUNT(*)`));
  return c.json(rows);
});

export default instrumentsRoute;
