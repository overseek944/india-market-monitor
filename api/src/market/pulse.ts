import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { marketSnapshots } from "../db/schema.js";
import { nseApi } from "../lib/nse.js";
import { bus } from "../lib/event-bus.js";

export interface IndexQuote {
  name: string;
  last: number;
  change: number;
  pctChange: number;
  open: number | null;
  high: number | null;
  low: number | null;
  previousClose: number | null;
  yearHigh: number | null;
  yearLow: number | null;
  pe: number | null;
  pb: number | null;
}

export interface FiiDiiRow {
  category: string;
  date: string;
  buyValue: number;
  sellValue: number;
  netValue: number;
}

interface NseAllIndices {
  data?: Array<{
    index?: string;
    indexSymbol?: string;
    last?: number;
    variation?: number;
    percentChange?: number;
    open?: number;
    high?: number;
    low?: number;
    previousClose?: number;
    yearHigh?: number;
    yearLow?: number;
    pe?: string;
    pb?: string;
  }>;
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
};

async function upsert(kind: string, payload: unknown): Promise<void> {
  await db
    .insert(marketSnapshots)
    .values({ kind, dataJson: JSON.stringify(payload), capturedAt: new Date() })
    .onConflictDoUpdate({
      target: marketSnapshots.kind,
      set: { dataJson: JSON.stringify(payload), capturedAt: new Date() },
    });
}

export async function refreshIndices(): Promise<boolean> {
  const data = await nseApi<NseAllIndices>("/api/allIndices", "https://www.nseindia.com/");
  if (!data?.data || !Array.isArray(data.data)) return false;
  const quotes: IndexQuote[] = data.data
    .filter((d) => d.index)
    .map((d) => ({
      name: d.index!,
      last: num(d.last) ?? 0,
      change: num(d.variation) ?? 0,
      pctChange: num(d.percentChange) ?? 0,
      open: num(d.open),
      high: num(d.high),
      low: num(d.low),
      previousClose: num(d.previousClose),
      yearHigh: num(d.yearHigh),
      yearLow: num(d.yearLow),
      pe: num(d.pe),
      pb: num(d.pb),
    }));
  if (quotes.length === 0) return false;
  await upsert("indices", quotes);
  return true;
}

export async function refreshFiiDii(): Promise<boolean> {
  const data = await nseApi<
    Array<{ category?: string; date?: string; buyValue?: string; sellValue?: string; netValue?: string }>
  >("/api/fiidiiTradeReact", "https://www.nseindia.com/");
  if (!Array.isArray(data) || data.length === 0) return false;
  const rows: FiiDiiRow[] = data.map((r) => ({
    category: r.category ?? "",
    date: r.date ?? "",
    buyValue: num(r.buyValue) ?? 0,
    sellValue: num(r.sellValue) ?? 0,
    netValue: num(r.netValue) ?? 0,
  }));
  await upsert("fii_dii", rows);
  return true;
}

export async function refreshPulse(): Promise<void> {
  const [a, b] = await Promise.allSettled([refreshIndices(), refreshFiiDii()]);
  const ok =
    (a.status === "fulfilled" && a.value) || (b.status === "fulfilled" && b.value);
  if (ok) bus.emit("pulse.updated", { at: Date.now() });
}

export async function getSnapshot<T>(kind: string): Promise<{ data: T; capturedAt: number } | null> {
  const rows = await db
    .select()
    .from(marketSnapshots)
    .where(eq(marketSnapshots.kind, kind))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  try {
    return {
      data: JSON.parse(row.dataJson) as T,
      capturedAt: row.capturedAt instanceof Date ? row.capturedAt.getTime() : Number(row.capturedAt),
    };
  } catch {
    return null;
  }
}

// Indices we surface prominently (headline + sectoral). Anything else stays available
// via the full snapshot but isn't pinned in the UI's curated rows.
export const HEADLINE_INDICES = ["NIFTY 50", "NIFTY BANK", "NIFTY NEXT 50", "INDIA VIX"];
export const SECTORAL_INDICES = [
  "NIFTY IT",
  "NIFTY AUTO",
  "NIFTY PHARMA",
  "NIFTY FMCG",
  "NIFTY METAL",
  "NIFTY ENERGY",
  "NIFTY REALTY",
  "NIFTY PSU BANK",
  "NIFTY FINANCIAL SERVICES",
  "NIFTY MIDCAP 100",
  "NIFTY SMALLCAP 100",
];
