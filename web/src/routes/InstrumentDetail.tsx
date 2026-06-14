import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from "recharts";
import { api } from "@/lib/api";
import FeedList from "@/components/FeedList";
import { FeedSkeleton } from "@/components/Skeleton";
import { useDensity } from "@/hooks/useDensity";
import { formatDayShort, titleCase } from "@/lib/format";
import type { Article } from "@/lib/types";

export default function InstrumentDetail() {
  const { symbol = "" } = useParams<{ symbol: string }>();
  const [density] = useDensity();
  const { data, isLoading, error } = useQuery({
    queryKey: ["instrument-detail", symbol],
    queryFn: () => api.instrumentDetail(symbol),
    refetchInterval: 45_000,
  });
  const { data: labels = {} } = useQuery({ queryKey: ["source-labels"], queryFn: api.sourceLabels, staleTime: 60_000 });

  if (error) {
    return (
      <div className="p-8 text-center text-sm text-zinc-400">
        Couldn’t load {symbol}. <Link to="/" className="text-[var(--color-accent)]">Back to watchlist</Link>
      </div>
    );
  }
  if (isLoading || !data) {
    return (
      <div className="p-4">
        <FeedSkeleton />
      </div>
    );
  }

  const inst = data.instrument;
  const timeline = data.timeline.map((a: Article) => ({ article: a, instrument: inst }));
  const chartData = data.trend.map((t) => ({ ...t, label: formatDayShort(t.day) }));

  return (
    <div className="h-full overflow-y-auto px-3 py-4 sm:px-5">
      <Link to="/" className="mb-3 inline-flex items-center gap-1 text-[12px] text-zinc-500 hover:text-zinc-300">
        <ArrowLeft className="size-3.5" /> Watchlist
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-mono text-xl font-bold tracking-wider text-[var(--color-accent)]">{inst.symbol}</h2>
            {inst.sector && <span className="rounded bg-zinc-800/60 px-2 py-0.5 text-[11px] text-zinc-300 ring-1 ring-zinc-700/50">{inst.sector}</span>}
          </div>
          <p className="mt-0.5 text-[13px] text-zinc-300">{inst.name}</p>
          <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-zinc-600">
            {inst.isin && <span>ISIN {inst.isin}</span>}
            {inst.bseCode && <span>BSE {inst.bseCode}</span>}
            {inst.series && <span>Series {inst.series}</span>}
            <span>{inst.articleCount ?? data.timeline.length} stored items</span>
          </div>
        </div>
        <div className="flex gap-2">
          <a
            href={`https://www.nseindia.com/get-quotes/equity?symbol=${encodeURIComponent(inst.symbol)}`}
            target="_blank"
            rel="noopener"
            className="flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-[12px] text-zinc-300 hover:text-[var(--color-accent)]"
          >
            NSE <ExternalLink className="size-3" />
          </a>
          {inst.isin && (
            <a
              href={`https://www.screener.in/company/${encodeURIComponent(inst.symbol)}/`}
              target="_blank"
              rel="noopener"
              className="flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-[12px] text-zinc-300 hover:text-[var(--color-accent)]"
            >
              Screener <ExternalLink className="size-3" />
            </a>
          )}
        </div>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 lg:col-span-2">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[1.5px] text-zinc-400">Sentiment trend (30d)</h3>
          {chartData.length === 0 ? (
            <p className="py-8 text-center text-[12px] text-zinc-600">Not enough scored items yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <Tooltip
                  contentStyle={{ background: "#09090b", border: "1px solid #27272a", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "#a1a1aa" }}
                />
                <Bar dataKey="bullish" stackId="s" fill="oklch(0.74 0.17 152)" radius={[0, 0, 0, 0]} />
                <Bar dataKey="neutral" stackId="s" fill="#3f3f46" />
                <Bar dataKey="bearish" stackId="s" fill="oklch(0.69 0.21 25)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[1.5px] text-zinc-400">Coverage breakdown</h3>
          <div className="space-y-2">
            <div>
              <div className="mb-1 text-[10px] uppercase text-zinc-600">By source</div>
              <div className="flex flex-wrap gap-1">
                {data.sourceBreakdown.slice(0, 8).map((s) => (
                  <span key={s.source} className="rounded bg-zinc-800/60 px-1.5 py-0.5 text-[11px] text-zinc-300 ring-1 ring-zinc-700/50">
                    {labels[s.source] ?? s.source} <span className="font-mono text-zinc-500">{s.n}</span>
                  </span>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1 text-[10px] uppercase text-zinc-600">By category</div>
              <div className="flex flex-wrap gap-1">
                {data.categoryBreakdown.filter((c) => c.category).slice(0, 8).map((c) => (
                  <span key={c.category} className="rounded bg-zinc-800/60 px-1.5 py-0.5 text-[11px] text-zinc-300 ring-1 ring-zinc-700/50">
                    {titleCase(c.category)} <span className="font-mono text-zinc-500">{c.n}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {data.top.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[1.5px] text-zinc-400">Top by relevance</h3>
          <FeedList items={data.top.map((a) => ({ article: a, instrument: inst }))} labels={labels} density="compact" />
        </div>
      )}

      <div className="mt-4">
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[1.5px] text-zinc-400">Timeline</h3>
        {timeline.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-zinc-500">No items stored yet — they’ll stream in on the next poll.</p>
        ) : (
          <FeedList items={timeline} labels={labels} density={density} />
        )}
      </div>
    </div>
  );
}
