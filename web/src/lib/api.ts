import type {
  Alert,
  CustomSource,
  CategoryStat,
  FeedFilters,
  FeedResponse,
  InboxResponse,
  Instrument,
  InstrumentDetail,
  InstrumentSearchHit,
  PulseResponse,
  SearchResponse,
  SectorStat,
  SourceMeta,
  Stats,
} from "./types";

const TIME_RANGE_MS: Record<string, number> = {
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

async function http<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!r.ok) {
    const body = await r.text();
    let msg = body;
    try {
      msg = JSON.parse(body).error ?? body;
    } catch {
      /* keep raw */
    }
    throw new Error(msg || `${r.status} ${r.statusText}`);
  }
  return r.json() as Promise<T>;
}

function feedParams(filters: FeedFilters): string {
  const p = new URLSearchParams();
  if (filters.scope) p.set("scope", filters.scope);
  if (filters.symbol) p.set("symbol", filters.symbol);
  if (filters.symbols?.length) p.set("symbols", filters.symbols.join(","));
  if (filters.source) p.set("source", filters.source);
  if (filters.sources?.length) p.set("sources", filters.sources.join(","));
  if (filters.categories?.length) p.set("categories", filters.categories.join(","));
  if (filters.minRelevance) p.set("min_relevance", String(filters.minRelevance));
  if (filters.sentiment) p.set("sentiment", filters.sentiment);
  if (filters.sort && filters.sort !== "newest") p.set("sort", filters.sort);
  if (filters.timeRange && filters.timeRange !== "all" && TIME_RANGE_MS[filters.timeRange]) {
    p.set("since_ms", String(Date.now() - TIME_RANGE_MS[filters.timeRange]!));
  }
  if (filters.includeBackfill) p.set("include_backfill", "1");
  return p.toString();
}

export const api = {
  // Instruments / watchlist
  listInstruments: () => http<Instrument[]>("/api/instruments"),
  searchInstruments: (q: string) =>
    http<InstrumentSearchHit[]>(`/api/instruments/search?q=${encodeURIComponent(q)}`),
  addInstrument: (symbol: string) =>
    http<Instrument>("/api/instruments", { method: "POST", body: JSON.stringify({ symbol }) }),
  addInstrumentsBulk: (symbols: string[]) =>
    http<{ added: string[]; skipped: string[]; notFound: string[] }>("/api/instruments/bulk", {
      method: "POST",
      body: JSON.stringify({ symbols }),
    }),
  removeInstrument: (id: number) =>
    http<{ ok: true }>(`/api/instruments/${id}`, { method: "DELETE" }),
  sectors: () => http<SectorStat[]>("/api/instruments/sectors"),
  instrumentDetail: (symbol: string) =>
    http<InstrumentDetail>(`/api/instrument/${encodeURIComponent(symbol)}`),

  // Feed / search
  feed: (filters: FeedFilters = {}) => http<FeedResponse>(`/api/feed?${feedParams(filters)}`),
  feedCategories: (scope = "instrument") =>
    http<CategoryStat[]>(`/api/feed/categories?scope=${scope}`),
  search: (q: string) => http<SearchResponse>(`/api/search?q=${encodeURIComponent(q)}`),

  // Market pulse
  pulse: () => http<PulseResponse>("/api/pulse"),
  refreshPulse: () => http<{ ok: true }>("/api/pulse/refresh", { method: "POST" }),

  // Meta
  stats: () => http<Stats>("/api/stats"),
  pollNow: () => http<{ queued: boolean }>("/api/poll", { method: "POST" }),

  // Sources
  builtinSources: () => http<SourceMeta[]>("/api/sources/builtin"),
  sourceLabels: () => http<Record<string, string>>("/api/sources/labels"),
  customSources: () => http<CustomSource[]>("/api/sources/custom"),
  addRssSource: (data: { name: string; url: string; scope?: string }) =>
    http<CustomSource>("/api/sources/rss", { method: "POST", body: JSON.stringify(data) }),
  toggleCustomSource: (id: number) =>
    http<{ ok: true; enabled: boolean }>(`/api/sources/${id}/toggle`, { method: "POST" }),
  deleteCustomSource: (id: number) =>
    http<{ ok: true }>(`/api/sources/${id}`, { method: "DELETE" }),

  // Alerts
  listAlerts: () => http<Alert[]>("/api/alerts"),
  addAlert: (data: {
    name: string;
    scope?: string;
    minRelevance?: number;
    sentimentFilter?: string | null;
    categoryFilter?: string | null;
    channel: "log" | "desktop" | "webhook";
    webhookUrl?: string;
  }) => http<Alert>("/api/alerts", { method: "POST", body: JSON.stringify(data) }),
  toggleAlert: (id: number) =>
    http<{ ok: true; enabled: boolean }>(`/api/alerts/${id}/toggle`, { method: "POST" }),
  deleteAlert: (id: number) => http<{ ok: true }>(`/api/alerts/${id}`, { method: "DELETE" }),
  inbox: () => http<InboxResponse>("/api/alerts/log"),
};
