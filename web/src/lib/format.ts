/** Display formatters. All accept nullish input and return a safe placeholder. */

const DASH = "—";
type DateInput = number | string | Date | null | undefined;

function toMs(v: DateInput): number | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) {
    const t = v.getTime();
    return Number.isFinite(t) ? t : null;
  }
  if (typeof v === "number") {
    if (!Number.isFinite(v) || v <= 0) return null;
    return v < 1e12 ? v * 1000 : v;
  }
  if (typeof v === "string") {
    const trimmed = v.trim();
    if (!trimmed) return null;
    const iso = Date.parse(trimmed);
    if (Number.isFinite(iso) && iso > 0) return iso;
    const n = Number(trimmed);
    if (Number.isFinite(n) && n > 0) return n < 1e12 ? n * 1000 : n;
    return null;
  }
  return null;
}

export function timeAgo(ts: DateInput): string {
  const ms = toMs(ts);
  if (ms === null) return DASH;
  const delta = Math.max(0, Date.now() - ms);
  const secs = Math.round(delta / 1000);
  if (secs < 5) return "just now";
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export function formatDateTime(ts: DateInput): string {
  const ms = toMs(ts);
  if (ms === null) return DASH;
  return new Date(ms).toLocaleString("en-IN", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDayShort(input: DateInput): string {
  if (input === null || input === undefined || input === "") return "";
  if (typeof input === "string") {
    const d = new Date(input);
    if (!Number.isNaN(d.getTime()))
      return d.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
  }
  const ms = toMs(input);
  if (ms === null) return String(input);
  return new Date(ms).toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}

export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "0";
  return n.toLocaleString("en-IN");
}

/** Index/price value with two decimals, Indian grouping: 23,622.90 */
export function formatPoints(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return DASH;
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Signed percent: +1.99% / -0.42% */
export function formatPct(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return DASH;
  const s = n > 0 ? "+" : "";
  return `${s}${n.toFixed(2)}%`;
}

/** ₹ value in crore from a rupee amount; accepts a crore figure directly too. */
export function formatCrore(croreValue: number | null | undefined): string {
  if (croreValue === null || croreValue === undefined || !Number.isFinite(croreValue)) return DASH;
  const sign = croreValue < 0 ? "-" : "";
  const v = Math.abs(croreValue);
  return `${sign}₹${v.toLocaleString("en-IN", { maximumFractionDigits: 0 })} Cr`;
}

export function titleCase(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/_/g, " ")
    .split(" ")
    .map((w) => (w.length === 0 ? "" : w[0]!.toUpperCase() + w.slice(1).toLowerCase()))
    .join(" ");
}

export function pluralize(n: number | null | undefined, singular: string, plural?: string): string {
  const safe = n ?? 0;
  const word = safe === 1 ? singular : plural ?? `${singular}s`;
  return `${formatNumber(safe)} ${word}`;
}

export function nonEmpty(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s.length === 0 ? null : s;
}

export function compactStamp(ts: DateInput): string {
  const ms = toMs(ts);
  if (ms === null) return DASH;
  const d = new Date(ms);
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  const date = d.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
  const time = d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
  return sameYear ? `${date} · ${time}` : `${d.getFullYear()} · ${date}`;
}

export function dayBucketLabel(ts: DateInput): string {
  const ms = toMs(ts);
  if (ms === null) return "Earlier";
  const d = new Date(ms);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const dStart = new Date(d);
  dStart.setHours(0, 0, 0, 0);
  const diffDays = Math.round((start.getTime() - dStart.getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays > 1 && diffDays < 7) return d.toLocaleDateString("en-IN", { weekday: "long" });
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return sameYear
    ? d.toLocaleDateString("en-IN", { month: "long", day: "numeric" })
    : d.toLocaleDateString("en-IN", { month: "long", day: "numeric", year: "numeric" });
}

export function dayKey(ts: DateInput): string {
  const ms = toMs(ts);
  if (ms === null) return "earlier";
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
