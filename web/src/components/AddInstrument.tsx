import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Check, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/hooks/useDebounce";

export default function AddInstrument() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const debounced = useDebounce(q, 200);

  const { data: hits = [], isFetching } = useQuery({
    queryKey: ["instrument-search", debounced],
    queryFn: () => api.searchInstruments(debounced),
    enabled: debounced.trim().length >= 1,
  });

  const add = useMutation({
    mutationFn: (symbol: string) => api.addInstrument(symbol),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["instruments"] });
      qc.invalidateQueries({ queryKey: ["sectors"] });
      qc.invalidateQueries({ queryKey: ["feed"] });
      setQ("");
      setOpen(false);
    },
  });

  return (
    <div className="relative">
      <div className="flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5 focus-within:border-[var(--color-accent)]">
        <Search className="size-3.5 text-zinc-500" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Add stock — RELIANCE, TCS, INFY…"
          className="w-full bg-transparent text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
          spellCheck={false}
        />
        {isFetching && <Loader2 className="size-3.5 animate-spin text-zinc-600" />}
      </div>

      {open && debounced.trim().length >= 1 && (
        <div className="absolute z-30 mt-1 max-h-80 w-full overflow-y-auto rounded-md border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/50">
          {hits.length === 0 ? (
            <div className="px-3 py-2 text-[12px] text-zinc-500">No NSE match for “{debounced}”.</div>
          ) : (
            hits.map((h) => (
              <button
                key={h.symbol}
                disabled={h.alreadyAdded || add.isPending}
                onClick={() => add.mutate(h.symbol)}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-1.5 text-left transition hover:bg-zinc-900",
                  h.alreadyAdded && "opacity-50"
                )}
              >
                <span className="w-24 shrink-0 font-mono text-[12px] font-bold text-[var(--color-accent)]">{h.symbol}</span>
                <span className="flex-1 truncate text-[12px] text-zinc-300">{h.name}</span>
                {h.sector && <span className="hidden shrink-0 text-[10px] text-zinc-600 sm:inline">{h.sector}</span>}
                {h.alreadyAdded ? (
                  <Check className="size-3.5 shrink-0 text-[var(--color-bull)]" />
                ) : (
                  <Plus className="size-3.5 shrink-0 text-zinc-500" />
                )}
              </button>
            ))
          )}
        </div>
      )}
      {open && <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />}
    </div>
  );
}
