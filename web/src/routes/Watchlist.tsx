import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Menu, Plus } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import Filters from "@/components/Filters";
import FeedList from "@/components/FeedList";
import { FeedSkeleton } from "@/components/Skeleton";
import AddInstrument from "@/components/AddInstrument";
import { api } from "@/lib/api";
import { useDensity } from "@/hooks/useDensity";
import type { FeedFilters } from "@/lib/types";

export default function Watchlist() {
  const [selected, setSelected] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [density, setDensity] = useDensity();
  const [filters, setFilters] = useState<FeedFilters>({
    scope: "instrument",
    minRelevance: 0,
    includeBackfill: true,
    sort: "newest",
    timeRange: "all",
  });

  const effective: FeedFilters = { ...filters, scope: "instrument", symbol: selected || undefined };

  const { data: feed, isLoading } = useQuery({
    queryKey: ["feed", effective],
    queryFn: () => api.feed(effective),
    refetchInterval: 30_000,
  });
  const { data: labels = {} } = useQuery({ queryKey: ["source-labels"], queryFn: api.sourceLabels, staleTime: 60_000 });
  const { data: instruments = [] } = useQuery({ queryKey: ["instruments"], queryFn: api.listInstruments });

  const items = feed?.items ?? [];
  const noInstruments = instruments.length === 0;

  return (
    <div className="flex h-full overflow-hidden">
      <Sidebar selectedSymbol={selected} onSelect={setSelected} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <section className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-900/40 px-3 py-1.5 md:hidden">
          <button onClick={() => setSidebarOpen(true)} className="rounded border border-zinc-800 bg-zinc-950 p-1 text-zinc-300">
            <Menu className="size-4" />
          </button>
          <span className="text-xs text-zinc-400">
            {selected ? <span className="font-mono font-semibold text-zinc-100">{selected}</span> : "All stocks"}
          </span>
        </div>

        <Filters filters={filters} onChange={setFilters} density={density} onDensityChange={setDensity} resultCount={items.length} />

        <div
          className={
            filters.includeBackfill
              ? "border-b border-amber-900/40 bg-amber-950/15 px-3 py-1 text-[11px] text-amber-300 sm:px-4"
              : "border-b border-emerald-900/30 bg-emerald-950/10 px-3 py-1 text-[11px] text-emerald-300 sm:px-4"
          }
        >
          {filters.includeBackfill ? (
            <>● Showing all history, including pre-add backfill.</>
          ) : (
            <>● <strong>Purist mode</strong> — only news published <em>after</em> you added each stock.</>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3 sm:px-4">
          {noInstruments ? (
            <WelcomeEmpty />
          ) : isLoading ? (
            <FeedSkeleton />
          ) : items.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-zinc-300">No news matches these filters yet.</p>
              <p className="mt-1 text-xs text-zinc-500">Widen the time range, lower min-relevance, or wait for the next poll.</p>
            </div>
          ) : (
            <FeedList
              items={items}
              labels={labels}
              density={density}
              onSourceClick={(src) =>
                setFilters((f) => {
                  const cur = f.sources ?? [];
                  const next = cur.includes(src) ? cur.filter((s) => s !== src) : [...cur, src];
                  return { ...f, sources: next.length ? next : undefined };
                })
              }
            />
          )}
        </div>
      </section>
    </div>
  );
}

function WelcomeEmpty() {
  return (
    <div className="mx-auto max-w-xl py-12 text-center">
      <div className="mb-3 inline-flex size-12 items-center justify-center rounded-xl bg-amber-950/30 ring-1 ring-amber-900/40">
        <Plus className="size-6 text-[var(--color-accent)]" />
      </div>
      <h2 className="text-base font-semibold text-zinc-100">Build your watchlist</h2>
      <p className="mx-auto mt-1 max-w-md text-[13px] text-zinc-400">
        Add NSE-listed stocks to start streaming their filings (NSE/BSE/SEBI), insider trades, and press coverage —
        each item scored by a local AI analyst.
      </p>
      <div className="mx-auto mt-5 max-w-sm">
        <AddInstrument />
      </div>
      <p className="mt-3 text-[11px] text-zinc-600">Try: RELIANCE · TCS · HDFCBANK · INFY · TATAMOTORS · ZOMATO</p>
    </div>
  );
}
