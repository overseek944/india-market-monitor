import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Gavel } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import FeedList from "@/components/FeedList";
import { FeedSkeleton } from "@/components/Skeleton";
import { useDensity } from "@/hooks/useDensity";

const TABS: Array<{ key: string; label: string; sources: string[] }> = [
  { key: "all", label: "All filings", sources: ["nse_announcements", "bse_announcements", "nse_insider", "sebi"] },
  { key: "nse", label: "NSE", sources: ["nse_announcements"] },
  { key: "bse", label: "BSE", sources: ["bse_announcements"] },
  { key: "insider", label: "Insider / PIT", sources: ["nse_insider"] },
  { key: "sebi", label: "SEBI", sources: ["sebi"] },
];

export default function RegulatoryRadar() {
  const [density, setDensity] = useDensity();
  const [tab, setTab] = useState("all");
  const active = TABS.find((t) => t.key === tab) ?? TABS[0]!;

  const { data: feed, isLoading } = useQuery({
    queryKey: ["feed", { scope: "all", radar: tab }],
    queryFn: () => api.feed({ scope: "all", sources: active.sources, sort: "newest", includeBackfill: true }),
    refetchInterval: 30_000,
  });
  const { data: labels = {} } = useQuery({ queryKey: ["source-labels"], queryFn: api.sourceLabels, staleTime: 60_000 });
  const items = feed?.items ?? [];

  return (
    <div className="h-full overflow-y-auto px-3 py-4 sm:px-5">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Gavel className="size-4 text-[var(--color-accent)]" />
          <div>
            <h2 className="text-base font-semibold text-zinc-100">Regulatory Radar</h2>
            <p className="text-[12px] text-zinc-500">Hard-signal disclosures only — exchange filings, insider trades, and SEBI actions.</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="font-mono text-[11px] text-zinc-500">{items.length}</span>
          <button
            onClick={() => setDensity(density === "compact" ? "comfortable" : "compact")}
            className="text-[11px] text-zinc-500 hover:text-zinc-300"
          >
            {density === "compact" ? "Comfortable" : "Compact"}
          </button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "rounded-md px-2.5 py-1 text-[12px] font-medium transition",
              tab === t.key ? "bg-[var(--color-accent)] text-zinc-950" : "bg-zinc-900 text-zinc-400 ring-1 ring-zinc-800 hover:text-zinc-200"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <FeedSkeleton />
      ) : items.length === 0 ? (
        <p className="py-12 text-center text-[13px] text-zinc-500">
          No filings yet. Add stocks to your watchlist — their NSE/BSE disclosures and insider trades will stream in here.
        </p>
      ) : (
        <FeedList items={items} labels={labels} density={density} />
      )}
    </div>
  );
}
