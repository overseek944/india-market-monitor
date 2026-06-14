import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Layers, Trash2, X } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { pluralize } from "@/lib/format";
import AddInstrument from "./AddInstrument";
import type { Instrument } from "@/lib/types";

interface Props {
  selectedSymbol: string;
  onSelect: (symbol: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ selectedSymbol, onSelect, isOpen, onClose }: Props) {
  const qc = useQueryClient();
  const { data: instruments = [] } = useQuery({ queryKey: ["instruments"], queryFn: api.listInstruments });
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const remove = useMutation({
    mutationFn: (id: number) => api.removeInstrument(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["instruments"] });
      qc.invalidateQueries({ queryKey: ["sectors"] });
      qc.invalidateQueries({ queryKey: ["feed"] });
    },
  });

  const groups = useMemo(() => groupBySector(instruments), [instruments]);
  const totalArticles = instruments.reduce((a, i) => a + (i.articleCount ?? 0), 0);

  return (
    <>
      {isOpen && <div className="fixed inset-0 z-20 bg-black/50 md:hidden" onClick={onClose} />}
      <aside
        className={cn(
          "z-30 flex w-72 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950",
          "fixed inset-y-0 left-0 transition-transform md:static md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[1.5px] text-zinc-400">
            <Layers className="size-3.5 text-[var(--color-accent)]" /> Watchlist
          </div>
          <button onClick={onClose} className="rounded p-1 text-zinc-500 hover:text-zinc-200 md:hidden">
            <X className="size-4" />
          </button>
        </div>

        <div className="border-b border-zinc-800 p-2">
          <AddInstrument />
        </div>

        <button
          onClick={() => onSelect("")}
          className={cn(
            "flex items-center justify-between border-b border-zinc-800/60 px-3 py-2 text-left text-[13px] transition hover:bg-zinc-900",
            selectedSymbol === "" ? "bg-zinc-900 text-zinc-100" : "text-zinc-400"
          )}
        >
          <span className="font-medium">All stocks</span>
          <span className="font-mono text-[11px] text-zinc-600">{pluralize(totalArticles, "item")}</span>
        </button>

        <div className="flex-1 overflow-y-auto">
          {instruments.length === 0 ? (
            <div className="px-3 py-6 text-center text-[12px] text-zinc-600">
              Search above to add your first stock.
            </div>
          ) : (
            groups.map(({ sector, items }) => {
              const isCollapsed = collapsed[sector];
              return (
                <div key={sector}>
                  <button
                    onClick={() => setCollapsed((c) => ({ ...c, [sector]: !c[sector] }))}
                    className="flex w-full items-center gap-1 bg-zinc-900/40 px-2 py-1 text-left text-[10px] font-semibold uppercase tracking-[1px] text-zinc-500 hover:text-zinc-300"
                  >
                    {isCollapsed ? <ChevronRight className="size-3" /> : <ChevronDown className="size-3" />}
                    <span className="truncate">{sector}</span>
                    <span className="ml-auto font-mono text-zinc-600">{items.length}</span>
                  </button>
                  {!isCollapsed &&
                    items.map((inst) => (
                      <div
                        key={inst.id}
                        className={cn(
                          "group flex items-center gap-2 px-3 py-1.5 transition hover:bg-zinc-900",
                          selectedSymbol === inst.symbol && "bg-zinc-900"
                        )}
                      >
                        <button onClick={() => onSelect(inst.symbol)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                          <span
                            className={cn(
                              "shrink-0 font-mono text-[12px] font-bold",
                              selectedSymbol === inst.symbol ? "text-[var(--color-accent)]" : "text-zinc-300"
                            )}
                          >
                            {inst.symbol}
                          </span>
                          <span className="truncate text-[11px] text-zinc-600">{inst.name}</span>
                        </button>
                        <span className="shrink-0 font-mono text-[10px] text-zinc-600">{inst.articleCount ?? 0}</span>
                        <button
                          onClick={() => remove.mutate(inst.id)}
                          className="shrink-0 text-zinc-700 opacity-0 transition hover:text-[var(--color-bear)] group-hover:opacity-100"
                          title={`Remove ${inst.symbol}`}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    ))}
                </div>
              );
            })
          )}
        </div>
      </aside>
    </>
  );
}

function groupBySector(instruments: Instrument[]): Array<{ sector: string; items: Instrument[] }> {
  const map = new Map<string, Instrument[]>();
  for (const i of instruments) {
    const key = i.sector || "Other";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(i);
  }
  return [...map.entries()]
    .map(([sector, items]) => ({ sector, items: items.sort((a, b) => a.symbol.localeCompare(b.symbol)) }))
    .sort((a, b) => (a.sector === "Other" ? 1 : b.sector === "Other" ? -1 : b.items.length - a.items.length));
}
