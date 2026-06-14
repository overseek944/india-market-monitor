/**
 * Indian exchange/regulator feeds emit IST (UTC+5:30) timestamps in several shapes:
 *   "10-Jun-2026 16:23:16"   (NSE an_dt)
 *   "2026-06-10 16:23:00"    (NSE sort_date / BSE NEWS_DT)
 *   "2026-06-10T16:23:16"    (BSE ISO-ish)
 * None carry a timezone, so we parse the wall-clock components and pin them to IST.
 */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function fromIstParts(y: number, mo: number, d: number, h: number, mi: number, s: number): Date | null {
  const utc = Date.UTC(y, mo, d, h, mi, s) - IST_OFFSET_MS;
  const dt = new Date(utc);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export function parseIstDate(input: string | null | undefined): Date | null {
  if (!input) return null;
  const s = input.trim();
  if (!s) return null;

  // DD-MMM-YYYY[ HH:mm:ss]
  let m = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) {
    const mo = MONTHS[m[2]!.toLowerCase()];
    if (mo === undefined) return null;
    return fromIstParts(+m[3]!, mo, +m[1]!, +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0));
  }

  // YYYY-MM-DD[ T]HH:mm:ss
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) {
    return fromIstParts(+m[1]!, +m[2]! - 1, +m[3]!, +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0));
  }

  // Last resort: native parse (RSS pubDates already carry an offset)
  const native = new Date(s);
  return Number.isNaN(native.getTime()) ? null : native;
}

/** YYYYMMDD in IST — the date format NSE/BSE query params expect. */
export function istDateStamp(d: Date): string {
  const ist = new Date(d.getTime() + IST_OFFSET_MS);
  const y = ist.getUTCFullYear();
  const mo = String(ist.getUTCMonth() + 1).padStart(2, "0");
  const day = String(ist.getUTCDate()).padStart(2, "0");
  return `${y}${mo}${day}`;
}
