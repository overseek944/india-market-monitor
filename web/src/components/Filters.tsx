import { SlidersHorizontal, Rows3, Rows4 } from "lucide-react";
import type { Density, FeedFilters, SortOrder, TimeRange } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  filters: FeedFilters;
  onChange: (f: FeedFilters) => void;
  density: Density;
  onDensityChange: (d: Density) => void;
  resultCount: number;
  showBackfillToggle?: boolean;
}

const TIME_RANGES: TimeRange[] = ["all", "1h", "24h", "7d", "30d"];
const SENTIMENTS = ["bullish", "bearish", "neutral"];
const SORTS: Array<{ v: SortOrder; label: string }> = [
  { v: "newest", label: "Newest" },
  { v: "relevance", label: "Relevance" },
  { v: "novelty", label: "Novelty" },
];

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded px-2 py-0.5 text-[11px] font-medium transition",
        active ? "bg-[var(--color-accent)] text-zinc-950" : "bg-zinc-900 text-zinc-400 ring-1 ring-zinc-800 hover:text-zinc-200"
      )}
    >
      {children}
    </button>
  );
}

export default function Filters({ filters, onChange, density, onDensityChange, resultCount, showBackfillToggle = true }: Props) {
  const set = (patch: Partial<FeedFilters>) => onChange({ ...filters, ...patch });

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-zinc-800 bg-zinc-900/40 px-3 py-2 sm:px-4">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
        <SlidersHorizontal className="size-3.5" />
        <span className="hidden sm:inline">Filters</span>
      </div>

      <div className="flex items-center gap-1">
        {TIME_RANGES.map((r) => (
          <Chip key={r} active={(filters.timeRange ?? "all") === r} onClick={() => set({ timeRange: r })}>
            {r === "all" ? "All time" : r}
          </Chip>
        ))}
      </div>

      <div className="flex items-center gap-1">
        {SENTIMENTS.map((s) => (
          <Chip key={s} active={filters.sentiment === s} onClick={() => set({ sentiment: filters.sentiment === s ? undefined : s })}>
            {s}
          </Chip>
        ))}
      </div>

      <div className="flex items-center gap-1">
        <span className="text-[10px] uppercase text-zinc-600">Min rel</span>
        {[0, 5, 7, 8].map((r) => (
          <Chip key={r} active={(filters.minRelevance ?? 0) === r} onClick={() => set({ minRelevance: r })}>
            {r === 0 ? "Any" : `≥${r}`}
          </Chip>
        ))}
      </div>

      <div className="flex items-center gap-1">
        {SORTS.map((s) => (
          <Chip key={s.v} active={(filters.sort ?? "newest") === s.v} onClick={() => set({ sort: s.v })}>
            {s.label}
          </Chip>
        ))}
      </div>

      <div className="ml-auto flex items-center gap-2">
        {showBackfillToggle && (
          <Chip active={!!filters.includeBackfill} onClick={() => set({ includeBackfill: !filters.includeBackfill })}>
            {filters.includeBackfill ? "All history" : "Purist"}
          </Chip>
        )}
        <span className="font-mono text-[11px] text-zinc-500">{resultCount}</span>
        <button
          onClick={() => onDensityChange(density === "compact" ? "comfortable" : "compact")}
          className="rounded border border-zinc-800 bg-zinc-950 p-1 text-zinc-400 hover:text-zinc-200"
          title={density === "compact" ? "Comfortable view" : "Compact view"}
        >
          {density === "compact" ? <Rows3 className="size-3.5" /> : <Rows4 className="size-3.5" />}
        </button>
      </div>
    </div>
  );
}
