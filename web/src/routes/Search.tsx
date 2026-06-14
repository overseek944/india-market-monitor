import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search as SearchIcon } from "lucide-react";
import { api } from "@/lib/api";
import FeedList from "@/components/FeedList";
import { FeedSkeleton } from "@/components/Skeleton";
import { useDensity } from "@/hooks/useDensity";
import { useDebounce } from "@/hooks/useDebounce";

export default function Search() {
  const [params, setParams] = useSearchParams();
  const [density] = useDensity();
  const [q, setQ] = useState(params.get("q") ?? "");
  const debounced = useDebounce(q, 250);

  useEffect(() => {
    if (debounced) setParams({ q: debounced }, { replace: true });
  }, [debounced, setParams]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["search", debounced],
    queryFn: () => api.search(debounced),
    enabled: debounced.trim().length >= 2,
  });
  const { data: labels = {} } = useQuery({ queryKey: ["source-labels"], queryFn: api.sourceLabels, staleTime: 60_000 });
  const items = data?.items ?? [];

  return (
    <div className="h-full overflow-y-auto px-3 py-4 sm:px-5">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 focus-within:border-[var(--color-accent)]">
          <SearchIcon className="size-4 text-zinc-500" />
          <input
            autoFocus
            data-search-input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Full-text search across every stored item — titles, summaries, thesis impact…"
            className="w-full bg-transparent text-[14px] text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
            spellCheck={false}
          />
        </div>
      </div>

      <div className="mt-4">
        {debounced.trim().length < 2 ? (
          <p className="py-12 text-center text-[13px] text-zinc-500">Type at least two characters to search.</p>
        ) : isLoading || isFetching ? (
          <FeedSkeleton />
        ) : items.length === 0 ? (
          <p className="py-12 text-center text-[13px] text-zinc-500">No results for “{debounced}”.</p>
        ) : (
          <>
            <p className="mb-2 text-[12px] text-zinc-500">{items.length} results for “{debounced}”</p>
            <FeedList items={items} labels={labels} density={density} />
          </>
        )}
      </div>
    </div>
  );
}
