export interface Instrument {
  id: number;
  symbol: string;
  name: string | null;
  isin: string | null;
  bseCode: string | null;
  sector: string | null;
  industry: string | null;
  series: string | null;
  addedAt: number | string;
  lastPolledAt: number | string | null;
  articleCount?: number;
}

export interface InstrumentSearchHit {
  symbol: string;
  name: string;
  isin: string | null;
  sector: string | null;
  alreadyAdded: boolean;
}

export interface Article {
  id: number;
  instrumentId: number | null;
  marketWide: boolean;
  source: string;
  externalId: string;
  title: string;
  url: string;
  canonicalUrl: string | null;
  description: string | null;
  author: string | null;
  publishedAt: number | string | null;
  ingestedAt: number | string;
  relevance: number | null;
  sentiment: string | null;
  category: string | null;
  thesisImpact: string | null;
  novelty: number | null;
  scoredAt: number | string | null;
  duplicateOf: number | null;
}

export interface FeedRow {
  article: Article;
  instrument: Instrument | null;
}

export interface FeedResponse {
  items: FeedRow[];
  scope: FeedScope;
  includeBackfill: boolean;
}

export type FeedScope = "instrument" | "market" | "all";

export interface SearchResponse {
  items: FeedRow[];
  query: string;
}

export interface Stats {
  instruments: number;
  articles: number;
  scored: number;
  marketWide: number;
  aiEnabled: boolean;
  pollInterval: number;
}

export interface SourceMeta {
  name: string;
  label: string;
  description: string;
  tier: number;
  category: string;
  scope: "instrument" | "market";
  enabled: boolean;
  count?: number;
}

export interface CategoryStat {
  category: string | null;
  n: number;
}

export interface SectorStat {
  sector: string | null;
  n: number;
}

export type SortOrder = "newest" | "relevance" | "novelty" | "oldest";
export type Density = "compact" | "comfortable";
export type TimeRange = "all" | "1h" | "24h" | "7d" | "30d";

export interface CustomSource {
  id: number;
  name: string;
  kind: string;
  configJson: string;
  enabled: boolean;
  scope: string;
  lastPolledAt: number | string | null;
  createdAt: number | string;
}

export interface Alert {
  id: number;
  name: string;
  enabled: boolean;
  scope: string;
  minRelevance: number;
  sentimentFilter: string | null;
  categoryFilter: string | null;
  channel: "log" | "desktop" | "webhook";
  channelConfig: string;
  createdAt: number | string;
}

export interface InboxRow {
  log: { id: number; alertId: number; articleId: number; firedAt: number | string; success: boolean; error: string | null };
  alert: Alert;
  article: Article;
  instrument: Instrument | null;
}

export interface InboxResponse {
  items: InboxRow[];
}

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

export interface PulseResponse {
  headline: IndexQuote[];
  sectoral: IndexQuote[];
  all: IndexQuote[];
  indicesAt: number | null;
  fiiDii: FiiDiiRow[];
  fiiDiiAt: number | null;
}

export interface TrendPoint {
  day: string;
  bullish: number;
  bearish: number;
  neutral: number;
  total: number;
}

export interface InstrumentDetail {
  instrument: Instrument;
  timeline: Article[];
  top: Article[];
  sourceBreakdown: Array<{ source: string; n: number }>;
  categoryBreakdown: Array<{ category: string | null; n: number }>;
  trend: TrendPoint[];
}

export interface FeedFilters {
  scope?: FeedScope;
  symbol?: string;
  symbols?: string[];
  source?: string;
  sources?: string[];
  categories?: string[];
  minRelevance?: number;
  sentiment?: string;
  timeRange?: TimeRange;
  sort?: SortOrder;
  includeBackfill?: boolean;
}
