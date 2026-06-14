import { and, eq } from "drizzle-orm";
import { db } from "./db/client.js";
import { alerts, alertLog, articles, instruments } from "./db/schema.js";
import { bus } from "./lib/event-bus.js";

function scopeMatches(scope: string, symbol: string | null, marketWide: boolean): boolean {
  const s = scope.trim().toLowerCase();
  if (!s || s === "all") return true;
  if (s === "market") return marketWide;
  if (marketWide) return false;
  if (!symbol) return false;
  return scope
    .split(",")
    .map((x) => x.trim().toUpperCase())
    .filter(Boolean)
    .includes(symbol.toUpperCase());
}

async function deliver(
  channel: string,
  channelConfig: string,
  payload: {
    alert: { id: number; name: string };
    article: { id: number; title: string; url: string; relevance: number | null; thesisImpact: string | null; sentiment: string | null; category: string | null };
    entity: { symbol: string | null; name: string | null; marketWide: boolean };
  }
): Promise<{ success: boolean; error: string | null }> {
  try {
    if (channel === "desktop") {
      // Surfaced to the browser via SSE; the web app raises a Notification.
      bus.emit("alert.fired", payload);
      return { success: true, error: null };
    }
    if (channel === "webhook") {
      const cfg = JSON.parse(channelConfig || "{}") as { url?: string };
      if (!cfg.url) return { success: false, error: "no webhook url" };
      const r = await fetch(cfg.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return { success: r.ok, error: r.ok ? null : `webhook ${r.status}` };
    }
    // 'log'
    console.log(
      `[alert:${payload.alert.name}] ${payload.entity.symbol ?? "MARKET"} · rel=${payload.article.relevance} · ${payload.article.title.slice(0, 80)}`
    );
    bus.emit("alert.fired", payload);
    return { success: true, error: null };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

export async function maybeFireAlerts(articleId: number): Promise<void> {
  const article = (await db.select().from(articles).where(eq(articles.id, articleId)).limit(1))[0];
  if (!article || article.duplicateOf !== null || article.relevance === null) return;

  let symbol: string | null = null;
  let name: string | null = null;
  if (article.instrumentId !== null) {
    const t = (
      await db.select().from(instruments).where(eq(instruments.id, article.instrumentId)).limit(1)
    )[0];
    symbol = t?.symbol ?? null;
    name = t?.name ?? null;
  }

  const rules = await db.select().from(alerts).where(eq(alerts.enabled, true));
  for (const rule of rules) {
    if (!scopeMatches(rule.scope, symbol, article.marketWide)) continue;
    if ((article.relevance ?? 0) < rule.minRelevance) continue;
    if (rule.sentimentFilter && article.sentiment !== rule.sentimentFilter) continue;
    if (rule.categoryFilter) {
      const cats = rule.categoryFilter.split(",").map((c) => c.trim().toLowerCase()).filter(Boolean);
      if (cats.length > 0 && (!article.category || !cats.includes(article.category))) continue;
    }

    // Dedup: never fire the same (alert, article) twice.
    const already = await db
      .select({ id: alertLog.id })
      .from(alertLog)
      .where(and(eq(alertLog.alertId, rule.id), eq(alertLog.articleId, article.id)))
      .limit(1);
    if (already.length > 0) continue;

    const payload = {
      alert: { id: rule.id, name: rule.name },
      article: {
        id: article.id,
        title: article.title,
        url: article.url,
        relevance: article.relevance,
        thesisImpact: article.thesisImpact,
        sentiment: article.sentiment,
        category: article.category,
      },
      entity: { symbol, name, marketWide: article.marketWide },
    };
    const { success, error } = await deliver(rule.channel, rule.channelConfig, payload);
    await db.insert(alertLog).values({ alertId: rule.id, articleId: article.id, success, error });
  }
}
