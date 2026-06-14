import type { InstrumentRef, InstrumentSource, NewsItem } from "./base.js";
import { nseApi } from "../lib/nse.js";
import { parseIstDate } from "../lib/dates.js";

interface NseAnn {
  symbol?: string;
  desc?: string;
  attchmntText?: string;
  attchmntFile?: string;
  an_dt?: string;
  sort_date?: string;
  smIndustry?: string;
}

/**
 * NSE Corporate Announcements — the primary regulatory disclosure stream for Indian
 * equities (board meetings, results, LODR Reg-30 material events, fund raising, etc.).
 * This is the SEC-EDGAR equivalent and the single highest-signal source in the app.
 */
export class NseAnnouncementsSource implements InstrumentSource {
  readonly scope = "instrument" as const;
  readonly name = "nse_announcements";
  readonly label = "NSE Announcements";
  readonly description =
    "Official NSE corporate filings — board meetings, results, Reg-30 material events, fund raising. Hard signal.";
  readonly tier = 1 as const;
  readonly category = "filing" as const;
  readonly enabled = true;

  async fetch(inst: InstrumentRef): Promise<NewsItem[]> {
    const sym = encodeURIComponent(inst.symbol);
    const data = await nseApi<NseAnn[]>(
      `/api/corporate-announcements?index=equities&symbol=${sym}`,
      `https://www.nseindia.com/get-quotes/equity?symbol=${sym}`
    );
    if (!Array.isArray(data)) return [];

    const items: NewsItem[] = [];
    for (const a of data.slice(0, 30)) {
      const subject = (a.desc ?? "").replace(/\s+/g, " ").trim();
      const body = (a.attchmntText ?? "").replace(/\s+/g, " ").trim();
      const title = subject || body.slice(0, 140) || "NSE corporate announcement";
      const file = a.attchmntFile ?? "";
      const url =
        file || `https://www.nseindia.com/get-quotes/equity?symbol=${sym}&tab=corp_info`;
      const externalId = file || `${inst.symbol}|${a.an_dt ?? ""}|${subject.slice(0, 80)}`;
      const publishedAt = parseIstDate(a.an_dt) ?? parseIstDate(a.sort_date);

      items.push({
        source: this.name,
        externalId,
        title: subject ? `[NSE] ${title}` : title,
        url,
        description: body || subject || null,
        publishedAt,
        extra: { industry: a.smIndustry },
      });
    }
    return items;
  }
}
