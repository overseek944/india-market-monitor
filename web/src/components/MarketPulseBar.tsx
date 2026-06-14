import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatPoints, formatPct } from "@/lib/format";
import type { IndexQuote } from "@/lib/types";

function Pill({ q }: { q: IndexQuote }) {
  const up = q.change >= 0;
  // INDIA VIX rising is "risk-off" — invert its colour so green still reads as calm.
  const isVix = q.name.toUpperCase().includes("VIX");
  const positive = isVix ? !up : up;
  return (
    <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap px-3 text-[12px]">
      <span className="font-semibold text-zinc-300">{q.name.replace(/^NIFTY /, "")}</span>
      <span className="font-mono text-zinc-100">{formatPoints(q.last)}</span>
      <span className={cn("font-mono", positive ? "text-[var(--color-bull)]" : "text-[var(--color-bear)]")}>
        {up ? "▲" : "▼"} {formatPct(q.pctChange)}
      </span>
    </span>
  );
}

export default function MarketPulseBar() {
  const { data } = useQuery({ queryKey: ["pulse-bar"], queryFn: api.pulse, refetchInterval: 60_000 });
  const quotes = data?.headline ?? [];

  return (
    <Link
      to="/pulse"
      className="group flex items-center gap-2 overflow-hidden border-b border-zinc-800 bg-zinc-950/80 px-3 py-1.5 backdrop-blur"
      title="Open Market Pulse"
    >
      <span className="shrink-0 rounded bg-[var(--color-accent)]/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[1.5px] text-[var(--color-accent)] ring-1 ring-amber-900/40">
        Live
      </span>
      {quotes.length === 0 ? (
        <span className="text-[12px] text-zinc-500">Loading market pulse… indices populate on the next NSE poll.</span>
      ) : (
        <div className="flex flex-1 items-center divide-x divide-zinc-800 overflow-x-auto">
          {quotes.map((q) => (
            <Pill key={q.name} q={q} />
          ))}
        </div>
      )}
    </Link>
  );
}
