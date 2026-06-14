import type { InstrumentRef, InstrumentSource, NewsItem } from "./base.js";
import { nseApi } from "../lib/nse.js";
import { parseIstDate } from "../lib/dates.js";

interface PitRow {
  symbol?: string;
  acqName?: string;
  date?: string;
  secAcq?: string; // # securities
  secVal?: string; // value
  tdpTransactionType?: string; // "Buy" | "Sell" | "Pledge" ...
  personCategory?: string; // "Promoters" | "Director" | ...
  secType?: string;
  acqMode?: string;
  xbrl?: string;
}

/**
 * NSE Insider Trading (SEBI PIT Reg-7 disclosures) — promoter/insider buys, sells and
 * pledges. A cluster of promoter buying (or pledging) is a classic high-conviction signal
 * that rarely surfaces in the general press.
 */
export class NseInsiderSource implements InstrumentSource {
  readonly scope = "instrument" as const;
  readonly name = "nse_insider";
  readonly label = "NSE Insider / PIT";
  readonly description =
    "Promoter & insider transactions (SEBI PIT Reg-7) — buys, sells and pledges. Strong conviction signal.";
  readonly tier = 1 as const;
  readonly category = "insider" as const;
  readonly enabled = true;

  async fetch(inst: InstrumentRef): Promise<NewsItem[]> {
    const sym = encodeURIComponent(inst.symbol);
    const data = await nseApi<{ data?: PitRow[] }>(
      `/api/corporates-pit?index=equities&symbol=${sym}`,
      `https://www.nseindia.com/get-quotes/equity?symbol=${sym}`
    );
    const rows = data?.data;
    if (!Array.isArray(rows)) return [];

    const items: NewsItem[] = [];
    for (const r of rows.slice(0, 25)) {
      const who = (r.acqName ?? "").replace(/\s+/g, " ").trim() || "Insider";
      const type = (r.tdpTransactionType ?? "").trim() || "transaction";
      const cat = (r.personCategory ?? "").trim();
      const qty = (r.secAcq ?? "").trim();
      const val = (r.secVal ?? "").trim();
      const valNum = Number(val.replace(/[, ]/g, ""));
      const valStr = Number.isFinite(valNum) && valNum > 0 ? ` (₹${formatCr(valNum)})` : "";
      const catStr = cat ? ` · ${cat}` : "";

      const title = `[Insider] ${who} — ${type}${catStr}${qty ? ` · ${qty} sh` : ""}${valStr}`;
      const externalId = `${inst.symbol}|${who}|${r.date ?? ""}|${type}|${qty}`;
      const publishedAt = parseIstDate(r.date);

      items.push({
        source: this.name,
        externalId,
        title,
        url: `https://www.nseindia.com/get-quotes/equity?symbol=${sym}&tab=corp_info`,
        description: `${type} by ${who}${catStr}. ${qty ? `${qty} securities` : ""}${valStr}. Mode: ${
          r.acqMode ?? "—"
        }.`,
        author: who,
        publishedAt,
        extra: { transactionType: type, personCategory: cat },
      });
    }
    return items;
  }
}

function formatCr(rupees: number): string {
  if (rupees >= 1e7) return `${(rupees / 1e7).toFixed(2)} Cr`;
  if (rupees >= 1e5) return `${(rupees / 1e5).toFixed(2)} L`;
  return rupees.toLocaleString("en-IN");
}
