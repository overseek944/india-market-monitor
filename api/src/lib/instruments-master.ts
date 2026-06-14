import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchWithTimeout, fetchJson } from "./http.js";

/**
 * The instrument master joins three free, official sources on ISIN:
 *   1. NSE EQUITY_L.csv        → symbol, company name, series, ISIN   (every NSE equity)
 *   2. BSE ListofScripData     → BSE scrip code, industry             (needed for BSE API)
 *   3. NSE Nifty-500 industry  → sector/industry classification       (top-500 enrichment)
 * Result is cached to data/instrument_master.json and refreshed daily.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_FILE = path.resolve(__dirname, "../../../data/instrument_master.json");
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const NSE_EQUITY_CSV = "https://archives.nseindia.com/content/equities/EQUITY_L.csv";
const NSE_NIFTY500_CSV = "https://nsearchives.nseindia.com/content/indices/ind_nifty500list.csv";
const BSE_SCRIPS =
  "https://api.bseindia.com/BseIndiaAPI/api/ListofScripData/w?Group=&Scripcode=&industry=&segment=Equity&status=Active";

export interface MasterEntry {
  symbol: string;
  name: string;
  isin: string | null;
  bseCode: string | null;
  sector: string | null;
  industry: string | null;
  series: string | null;
}

let master: Map<string, MasterEntry> | null = null;
let byIsin: Map<string, MasterEntry> | null = null;

/** Parse a single CSV line honoring double-quoted fields. */
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQ = false;
      } else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

async function fetchNseEquities(): Promise<Map<string, MasterEntry>> {
  const r = await fetchWithTimeout(NSE_EQUITY_CSV, { timeoutMs: 25_000, retries: 2 });
  if (!r.ok) throw new Error(`NSE EQUITY_L.csv -> ${r.status}`);
  const text = await r.text();
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const m = new Map<string, MasterEntry>();
  // Header: SYMBOL,NAME OF COMPANY, SERIES, DATE OF LISTING, PAID UP VALUE, MARKET LOT, ISIN NUMBER, FACE VALUE
  for (let i = 1; i < lines.length; i++) {
    const c = parseCsvLine(lines[i]!);
    const symbol = (c[0] ?? "").toUpperCase();
    if (!symbol) continue;
    m.set(symbol, {
      symbol,
      name: c[1] ?? symbol,
      series: c[2] || null,
      isin: (c[6] || "").toUpperCase() || null,
      bseCode: null,
      sector: null,
      industry: null,
    });
  }
  return m;
}

async function enrichBse(m: Map<string, MasterEntry>): Promise<void> {
  try {
    const scrips = await fetchJson<
      Array<{ SCRIP_CD: string; ISIN_NUMBER: string; INDUSTRY: string | null }>
    >(BSE_SCRIPS, {
      timeoutMs: 25_000,
      retries: 2,
      headers: { Referer: "https://www.bseindia.com/", Origin: "https://www.bseindia.com" },
    });
    if (!Array.isArray(scrips)) return;
    const byIsinLocal = new Map<string, MasterEntry>();
    for (const e of m.values()) if (e.isin) byIsinLocal.set(e.isin, e);
    for (const s of scrips) {
      const isin = (s.ISIN_NUMBER || "").toUpperCase();
      const hit = isin ? byIsinLocal.get(isin) : undefined;
      if (hit) {
        hit.bseCode = String(s.SCRIP_CD);
        if (s.INDUSTRY) hit.industry = s.INDUSTRY;
      }
    }
  } catch (e) {
    console.warn(`[master] BSE scrip enrich skipped: ${(e as Error).message}`);
  }
}

async function enrichSectors(m: Map<string, MasterEntry>): Promise<void> {
  try {
    const r = await fetchWithTimeout(NSE_NIFTY500_CSV, { timeoutMs: 20_000, retries: 1 });
    if (!r.ok) return;
    const text = await r.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    // Header: Company Name, Industry, Symbol, Series, ISIN Code
    const header = parseCsvLine(lines[0]!).map((h) => h.toLowerCase());
    const iSym = header.findIndex((h) => h === "symbol");
    const iInd = header.findIndex((h) => h.includes("industry"));
    if (iSym < 0 || iInd < 0) return;
    for (let i = 1; i < lines.length; i++) {
      const c = parseCsvLine(lines[i]!);
      const sym = (c[iSym] ?? "").toUpperCase();
      const ind = c[iInd] ?? "";
      const hit = m.get(sym);
      if (hit && ind) hit.sector = ind;
    }
  } catch (e) {
    console.warn(`[master] sector enrich skipped: ${(e as Error).message}`);
  }
}

function indexByIsin(m: Map<string, MasterEntry>): Map<string, MasterEntry> {
  const idx = new Map<string, MasterEntry>();
  for (const e of m.values()) if (e.isin) idx.set(e.isin, e);
  return idx;
}

async function build(): Promise<Map<string, MasterEntry>> {
  const m = await fetchNseEquities();
  await enrichBse(m);
  await enrichSectors(m);
  return m;
}

function loadCache(): Map<string, MasterEntry> | null {
  try {
    if (!fs.existsSync(CACHE_FILE)) return null;
    const stat = fs.statSync(CACHE_FILE);
    if (Date.now() - stat.mtimeMs > CACHE_TTL_MS) return null;
    const raw = JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8")) as MasterEntry[];
    if (!Array.isArray(raw) || raw.length === 0) return null;
    return new Map(raw.map((e) => [e.symbol, e]));
  } catch {
    return null;
  }
}

function saveCache(m: Map<string, MasterEntry>): void {
  try {
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify([...m.values()]));
  } catch (e) {
    console.warn(`[master] cache write failed: ${(e as Error).message}`);
  }
}

export async function getMaster(): Promise<Map<string, MasterEntry>> {
  if (master) return master;
  const cached = loadCache();
  if (cached) {
    master = cached;
    byIsin = indexByIsin(cached);
    return cached;
  }
  const built = await build();
  saveCache(built);
  master = built;
  byIsin = indexByIsin(built);
  console.log(`[master] loaded ${built.size} NSE instruments`);
  return built;
}

export async function lookupInstrument(symbol: string): Promise<MasterEntry | null> {
  const m = await getMaster();
  return m.get(symbol.trim().toUpperCase()) ?? null;
}

/** Fuzzy search by symbol or company name, ranked: exact symbol > symbol-prefix > name. */
export async function searchInstruments(q: string, limit = 12): Promise<MasterEntry[]> {
  const m = await getMaster();
  const query = q.trim().toUpperCase();
  if (!query) return [];
  const scored: Array<{ e: MasterEntry; score: number }> = [];
  for (const e of m.values()) {
    const sym = e.symbol;
    const name = (e.name ?? "").toUpperCase();
    let score = -1;
    if (sym === query) score = 100;
    else if (sym.startsWith(query)) score = 80 - sym.length;
    else if (name.startsWith(query)) score = 60 - name.length * 0.01;
    else if (sym.includes(query)) score = 40;
    else if (name.includes(query)) score = 30 - name.length * 0.01;
    if (score > 0) scored.push({ e, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.e);
}

export { byIsin };
