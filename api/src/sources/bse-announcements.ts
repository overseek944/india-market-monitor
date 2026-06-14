import type { InstrumentRef, InstrumentSource, NewsItem } from "./base.js";
import { fetchJson } from "../lib/http.js";
import { parseIstDate, istDateStamp } from "../lib/dates.js";

interface BseAnnRow {
  NEWSID?: string;
  SCRIP_CD?: string;
  NEWSSUB?: string;
  HEADLINE?: string;
  NEWS_DT?: string;
  ATTACHMENTNAME?: string;
  CATEGORYNAME?: string;
  MORE?: string;
  NSURL?: string;
}

/**
 * BSE Corporate Announcements (AnnGetData) — complements NSE for BSE-cross-listed and
 * BSE-only names, and occasionally surfaces filings before they hit the NSE feed.
 * Best-effort: BSE's CDN is stricter, so failures degrade quietly.
 */
export class BseAnnouncementsSource implements InstrumentSource {
  readonly scope = "instrument" as const;
  readonly name = "bse_announcements";
  readonly label = "BSE Announcements";
  readonly description =
    "Official BSE corporate filings — complements NSE and covers BSE-only listings.";
  readonly tier = 1 as const;
  readonly category = "filing" as const;
  readonly enabled = true;

  async fetch(inst: InstrumentRef): Promise<NewsItem[]> {
    if (!inst.bseCode) return [];
    const now = new Date();
    const prev = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const url =
      `https://api.bseindia.com/BseIndiaAPI/api/AnnGetData/w?pageno=1&strCat=-1` +
      `&strPrevDate=${istDateStamp(prev)}&strScrip=${inst.bseCode}` +
      `&strSearch=P&strToDate=${istDateStamp(now)}&strType=C`;

    let data: { Table?: BseAnnRow[] } | string;
    try {
      data = await fetchJson<{ Table?: BseAnnRow[] } | string>(url, {
        timeoutMs: 15_000,
        headers: {
          Referer: "https://www.bseindia.com/corporates/ann.html",
          Origin: "https://www.bseindia.com",
        },
      });
    } catch (e) {
      console.warn(`[bse_announcements] ${inst.symbol}: ${(e as Error).message}`);
      return [];
    }
    if (typeof data === "string" || !data?.Table || !Array.isArray(data.Table)) return [];

    const items: NewsItem[] = [];
    for (const r of data.Table.slice(0, 30)) {
      const subject = (r.NEWSSUB ?? r.HEADLINE ?? "").replace(/\s+/g, " ").trim();
      if (!subject) continue;
      const att = (r.ATTACHMENTNAME ?? "").trim();
      const url2 = att
        ? `https://www.bseindia.com/xml-data/corpfiling/AttachLive/${att}`
        : r.NSURL || `https://www.bseindia.com/corporates/ann.html`;
      const externalId = r.NEWSID || `${inst.bseCode}|${r.NEWS_DT ?? ""}|${subject.slice(0, 80)}`;
      const publishedAt = parseIstDate(r.NEWS_DT);

      items.push({
        source: this.name,
        externalId,
        title: `[BSE] ${subject}`,
        url: url2,
        description: (r.HEADLINE ?? r.MORE ?? "").replace(/\s+/g, " ").trim() || subject,
        publishedAt,
        extra: { category: r.CATEGORYNAME },
      });
    }
    return items;
  }
}
