import { useQuery } from "@tanstack/react-query";
import { ArrowDownRight, ArrowUpRight, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatPoints, formatPct, formatCrore, timeAgo } from "@/lib/format";
import FeedList from "@/components/FeedList";
import { FeedSkeleton } from "@/components/Skeleton";
import { useDensity } from "@/hooks/useDensity";
import type { FiiDiiRow, IndexQuote } from "@/lib/types";

function IndexCard({ q }: { q: IndexQuote }) {
  const up = q.change >= 0;
  const isVix = q.name.toUpperCase().includes("VIX");
  const good = isVix ? !up : up;
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{q.name}</span>
        {up ? (
          <ArrowUpRight className={cn("size-4", good ? "text-[var(--color-bull)]" : "text-[var(--color-bear)]")} />
        ) : (
          <ArrowDownRight className={cn("size-4", good ? "text-[var(--color-bull)]" : "text-[var(--color-bear)]")} />
        )}
      </div>
      <div className="mt-1 font-mono text-xl font-semibold text-zinc-100">{formatPoints(q.last)}</div>
      <div className={cn("font-mono text-[12px]", good ? "text-[var(--color-bull)]" : "text-[var(--color-bear)]")}>
        {up ? "+" : ""}
        {formatPoints(q.change)} ({formatPct(q.pctChange)})
      </div>
      {(q.pe || q.high) && (
        <div className="mt-1.5 flex gap-3 text-[10px] text-zinc-600">
          {q.pe ? <span>P/E {q.pe.toFixed(1)}</span> : null}
          {q.high ? <span>H {formatPoints(q.high)}</span> : null}
          {q.low ? <span>L {formatPoints(q.low)}</span> : null}
        </div>
      )}
    </div>
  );
}

function heatColor(pct: number): string {
  const m = Math.min(Math.abs(pct) / 3, 1); // saturate at ±3%
  const alpha = 0.12 + m * 0.5;
  return pct >= 0 ? `rgba(16,185,129,${alpha})` : `rgba(244,63,94,${alpha})`;
}

function SectorTile({ q }: { q: IndexQuote }) {
  return (
    <div
      className="rounded-md border border-zinc-800 px-2.5 py-2"
      style={{ backgroundColor: heatColor(q.pctChange) }}
      title={`${q.name} · ${formatPoints(q.last)}`}
    >
      <div className="truncate text-[10.5px] font-semibold text-zinc-200">{q.name.replace(/^NIFTY /, "")}</div>
      <div className="font-mono text-[13px] font-bold text-zinc-50">{formatPct(q.pctChange)}</div>
    </div>
  );
}

function FiiDiiCard({ row }: { row: FiiDiiRow }) {
  const net = row.netValue;
  const positive = net >= 0;
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold text-zinc-200">{row.category}</span>
        <span className="text-[10px] text-zinc-600">{row.date}</span>
      </div>
      <div className={cn("mt-1 font-mono text-lg font-semibold", positive ? "text-[var(--color-bull)]" : "text-[var(--color-bear)]")}>
        {positive ? "+" : ""}
        {formatCrore(net)}
      </div>
      <div className="mt-1 flex gap-3 text-[10px] text-zinc-500">
        <span>Buy {formatCrore(row.buyValue)}</span>
        <span>Sell {formatCrore(row.sellValue)}</span>
      </div>
    </div>
  );
}

export default function MarketPulse() {
  const [density, setDensity] = useDensity();
  const { data: pulse } = useQuery({ queryKey: ["pulse-bar"], queryFn: api.pulse, refetchInterval: 60_000 });
  const { data: feed, isLoading } = useQuery({
    queryKey: ["feed", { scope: "market" }],
    queryFn: () => api.feed({ scope: "market", sort: "newest" }),
    refetchInterval: 30_000,
  });
  const { data: labels = {} } = useQuery({ queryKey: ["source-labels"], queryFn: api.sourceLabels, staleTime: 60_000 });

  const headline = pulse?.headline ?? [];
  const sectoral = (pulse?.sectoral ?? []).slice().sort((a, b) => b.pctChange - a.pctChange);
  const fiiDii = pulse?.fiiDii ?? [];
  const items = feed?.items ?? [];

  return (
    <div className="h-full overflow-y-auto px-3 py-4 sm:px-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-zinc-100">Market Pulse</h2>
          <p className="text-[12px] text-zinc-500">
            Live indices, sector breadth, and institutional flows from NSE · {pulse?.indicesAt ? `updated ${timeAgo(pulse.indicesAt)}` : "awaiting first poll"}
          </p>
        </div>
        <button
          onClick={() => api.refreshPulse()}
          className="flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-[12px] text-zinc-300 hover:border-zinc-700 hover:text-[var(--color-accent)]"
        >
          <RefreshCw className="size-3.5" /> Refresh
        </button>
      </div>

      {headline.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {headline.map((q) => (
            <IndexCard key={q.name} q={q} />
          ))}
        </div>
      )}

      {fiiDii.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[1.5px] text-zinc-400">
            FII / DII Activity (₹ Cr, cash market)
          </h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {fiiDii.map((r) => (
              <FiiDiiCard key={r.category} row={r} />
            ))}
          </div>
        </div>
      )}

      {sectoral.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[1.5px] text-zinc-400">Sector Heatmap</h3>
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 lg:grid-cols-6">
            {sectoral.map((q) => (
              <SectorTile key={q.name} q={q} />
            ))}
          </div>
        </div>
      )}

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-[11px] font-semibold uppercase tracking-[1.5px] text-zinc-400">Market-Wide News & Macro</h3>
          <button
            onClick={() => setDensity(density === "compact" ? "comfortable" : "compact")}
            className="text-[11px] text-zinc-500 hover:text-zinc-300"
          >
            {density === "compact" ? "Comfortable" : "Compact"}
          </button>
        </div>
        {isLoading ? (
          <FeedSkeleton />
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-zinc-500">
            Macro, SEBI and press items will appear here after the first ingest cycle.
          </p>
        ) : (
          <FeedList items={items} labels={labels} density={density} />
        )}
      </div>
    </div>
  );
}
