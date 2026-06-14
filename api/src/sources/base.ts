export interface NewsItem {
  source: string;
  externalId: string;
  title: string;
  url: string;
  description?: string | null;
  author?: string | null;
  publishedAt?: Date | null;
  /** Symbols a market-wide item explicitly references (optional). */
  symbols?: string[];
  extra?: Record<string, unknown>;
}

export interface InstrumentRef {
  id: number;
  symbol: string;
  name: string | null;
  isin: string | null;
  bseCode: string | null;
  sector: string | null;
}

export type SourceTier = 1 | 2 | 3;
export type SourceCategory =
  | "filing"
  | "insider"
  | "news"
  | "regulatory"
  | "macro"
  | "research"
  | "social";

interface BaseSourceMeta {
  /** Stable machine name, also stored on every article row. */
  readonly name: string;
  readonly label: string;
  readonly description: string;
  /** 1 = hard/official signal, 2 = quality press, 3 = social/sentiment. */
  readonly tier: SourceTier;
  readonly category: SourceCategory;
  readonly enabled: boolean;
}

/** A source fetched once per watched instrument. */
export interface InstrumentSource extends BaseSourceMeta {
  readonly scope: "instrument";
  fetch(inst: InstrumentRef): Promise<NewsItem[]>;
}

/** A source fetched once per cycle, producing market-wide items. */
export interface MarketSource extends BaseSourceMeta {
  readonly scope: "market";
  fetch(): Promise<NewsItem[]>;
}

export type Source = InstrumentSource | MarketSource;

export function isInstrumentSource(s: Source): s is InstrumentSource {
  return s.scope === "instrument";
}
export function isMarketSource(s: Source): s is MarketSource {
  return s.scope === "market";
}
