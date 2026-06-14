import { Link } from "react-router-dom";
import { ExternalLink, TrendingDown, TrendingUp, Minus, Globe2 } from "lucide-react";
import type { Article, Density, Instrument } from "@/lib/types";
import { cn } from "@/lib/utils";
import { compactStamp, formatDateTime, nonEmpty, timeAgo, titleCase } from "@/lib/format";

interface Props {
  article: Article;
  instrument: Instrument | null;
  sourceLabel: string;
  density?: Density;
  onSourceClick?: (source: string) => void;
}

const SENT_COLORS: Record<string, string> = {
  bullish: "text-[var(--color-bull)] bg-emerald-950/40 ring-emerald-900/50",
  bearish: "text-[var(--color-bear)] bg-rose-950/40 ring-rose-900/50",
  neutral: "text-zinc-400 bg-zinc-900 ring-zinc-800",
};

const SOURCE_STYLE: Record<string, string> = {
  nse_announcements: "text-amber-300 bg-amber-950/40 ring-amber-900/50",
  bse_announcements: "text-orange-300 bg-orange-950/40 ring-orange-900/50",
  nse_insider: "text-sky-300 bg-sky-950/40 ring-sky-900/50",
  sebi: "text-fuchsia-300 bg-fuchsia-950/40 ring-fuchsia-900/50",
  google_news_in: "text-zinc-300 bg-zinc-800/60 ring-zinc-700/50",
  macro_radar: "text-cyan-300 bg-cyan-950/40 ring-cyan-900/50",
  et_markets: "text-rose-200 bg-rose-950/30 ring-rose-900/40",
  livemint_markets: "text-emerald-200 bg-emerald-950/30 ring-emerald-900/40",
  businessline_markets: "text-violet-300 bg-violet-950/40 ring-violet-900/50",
  reddit_in: "text-orange-300 bg-orange-950/40 ring-orange-900/50",
};

function sourceStyle(source: string): string {
  if (SOURCE_STYLE[source]) return SOURCE_STYLE[source]!;
  if (source.startsWith("custom_")) return "text-[var(--color-accent)] bg-zinc-800/60 ring-amber-900/40";
  return "text-zinc-300 bg-zinc-800/60 ring-zinc-700/50";
}

export default function FeedCard({ article, instrument, sourceLabel, density = "comfortable", onSourceClick }: Props) {
  const high = (article.relevance ?? 0) >= 8;
  const sentBadge = article.sentiment && SENT_COLORS[article.sentiment] ? SENT_COLORS[article.sentiment]! : SENT_COLORS.neutral;
  const SentIcon = article.sentiment === "bullish" ? TrendingUp : article.sentiment === "bearish" ? TrendingDown : Minus;

  const author = nonEmpty(article.author);
  const description = nonEmpty(article.description);
  const thesisImpact = nonEmpty(article.thesisImpact);
  const category = nonEmpty(article.category);
  const sentiment = nonEmpty(article.sentiment);
  const hasRelevance = typeof article.relevance === "number";
  const hasNovelty = typeof article.novelty === "number";
  const ts = article.publishedAt ?? article.ingestedAt;
  const isCompact = density === "compact";

  return (
    <article
      className={cn(
        "group flex h-full flex-col rounded-md border border-zinc-800 bg-zinc-900/40 transition hover:border-zinc-700",
        high && "border-l-2 border-l-[var(--color-accent)]",
        isCompact ? "px-3 py-2" : "p-3"
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        {instrument ? (
          <Link
            to={`/stock/${instrument.symbol}`}
            className="rounded bg-amber-950/30 px-1.5 py-0.5 font-mono text-[11px] font-bold tracking-wider text-[var(--color-accent)] ring-1 ring-amber-900/50 transition hover:bg-amber-950/60 hover:ring-[var(--color-accent)]"
            title={`Open ${instrument.symbol}`}
          >
            {instrument.symbol}
          </Link>
        ) : (
          <Link
            to="/pulse"
            className="flex items-center gap-1 rounded bg-cyan-950/30 px-1.5 py-0.5 font-mono text-[11px] font-bold tracking-wider text-cyan-300 ring-1 ring-cyan-900/50 transition hover:bg-cyan-950/60"
            title="Market-wide — open Market Pulse"
          >
            <Globe2 className="size-3" /> MARKET
          </Link>
        )}
        <button
          type="button"
          onClick={() => onSourceClick?.(article.source)}
          className={cn(
            "rounded px-1.5 py-0.5 text-[11px] font-medium ring-1 transition",
            sourceStyle(article.source),
            onSourceClick && "cursor-pointer hover:brightness-125"
          )}
          title={onSourceClick ? `Filter by ${sourceLabel}` : sourceLabel}
        >
          {sourceLabel}
        </button>
        {category && !isCompact && (
          <span className="rounded bg-zinc-900 px-1.5 py-0.5 text-[11px] font-medium text-zinc-400 ring-1 ring-zinc-800">
            {titleCase(category)}
          </span>
        )}
        {sentiment && (
          <span className={cn("flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium ring-1", sentBadge)}>
            <SentIcon className="size-3" />
            {!isCompact && sentiment}
          </span>
        )}
        <span className="ml-auto flex items-baseline gap-1.5 text-[11px] text-zinc-400" title={formatDateTime(ts)}>
          <span className="font-mono">{compactStamp(ts)}</span>
          <span className="text-zinc-600">·</span>
          <span className="text-zinc-500">{timeAgo(ts)}</span>
        </span>
      </div>

      <a
        href={article.url}
        target="_blank"
        rel="noopener"
        className={cn(
          "mt-1.5 block font-semibold leading-snug text-zinc-100 hover:text-[var(--color-accent)]",
          isCompact ? "text-[13px]" : "text-[14px]"
        )}
      >
        {article.title}
        <ExternalLink className="ml-1 inline size-3 opacity-50" />
      </a>

      {!isCompact && description && (
        <p className="mt-1 line-clamp-2 text-[12.5px] leading-snug text-zinc-400">{description}</p>
      )}

      {!isCompact && thesisImpact && thesisImpact.toLowerCase() !== "no thesis impact" && (
        <div className="mt-2 rounded border border-amber-900/40 bg-amber-950/20 px-2 py-1">
          <div className="text-[9px] font-bold uppercase tracking-[1.5px] text-[var(--color-accent)]">Thesis impact</div>
          <div className="mt-0.5 text-[12.5px] leading-snug text-zinc-200">{thesisImpact}</div>
        </div>
      )}

      {(hasRelevance || hasNovelty) && (
        <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-1.5 text-[10px] uppercase tracking-wider text-zinc-500">
          {hasRelevance && (
            <div className="flex items-center gap-1.5">
              <span>Rel</span>
              <div className="h-1 w-16 overflow-hidden rounded-full bg-zinc-800">
                <div className="h-full bg-gradient-to-r from-[var(--color-accent)] to-amber-400" style={{ width: `${(article.relevance ?? 0) * 10}%` }} />
              </div>
              <span className="font-mono text-zinc-300">{article.relevance}</span>
            </div>
          )}
          {hasNovelty && (
            <div className="flex items-center gap-1.5">
              <span>Nov</span>
              <div className="h-1 w-16 overflow-hidden rounded-full bg-zinc-800">
                <div className="h-full bg-gradient-to-r from-[var(--color-warn)] to-orange-400" style={{ width: `${(article.novelty ?? 0) * 10}%` }} />
              </div>
              <span className="font-mono text-zinc-300">{article.novelty}</span>
            </div>
          )}
          {category && isCompact && (
            <span className="ml-auto rounded bg-zinc-900 px-1.5 py-0 text-[10px] text-zinc-400">{titleCase(category)}</span>
          )}
        </div>
      )}

      {!isCompact && author && <div className="mt-1 line-clamp-1 text-[10.5px] text-zinc-500">via {author}</div>}
    </article>
  );
}
