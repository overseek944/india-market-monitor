import { useEffect } from "react";
import { Outlet, NavLink, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Bell,
  Gavel,
  Layers,
  RefreshCw,
  Search as SearchIcon,
  Sparkles,
  Circle,
  LineChart,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { pluralize } from "@/lib/format";
import SearchBar from "@/components/SearchBar";
import MarketPulseBar from "@/components/MarketPulseBar";
import { useSSE } from "@/hooks/useSSE";
import { useDesktopNotifications } from "@/hooks/useDesktopNotifications";

interface AlertFiredEvent {
  alert: { id: number; name: string };
  article: { title: string; relevance: number | null; thesisImpact: string | null; url: string };
  entity: { symbol: string | null };
}

const NAV = [
  { to: "/", end: true, icon: Activity, label: "Watchlist" },
  { to: "/pulse", icon: LineChart, label: "Pulse" },
  { to: "/radar", icon: Gavel, label: "Radar" },
  { to: "/alerts", icon: Bell, label: "Alerts" },
  { to: "/search", icon: SearchIcon, label: "Search" },
  { to: "/sources", icon: Layers, label: "Sources" },
];

export default function App() {
  const qc = useQueryClient();
  const { notify } = useDesktopNotifications();

  const { data: stats } = useQuery({ queryKey: ["stats"], queryFn: api.stats, refetchInterval: 20_000 });

  useSSE({
    "articles.new": () => {
      qc.invalidateQueries({ queryKey: ["feed"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      qc.invalidateQueries({ queryKey: ["instruments"] });
    },
    "article.scored": () => {
      qc.invalidateQueries({ queryKey: ["feed"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
    },
    "instrument.added": () => {
      qc.invalidateQueries({ queryKey: ["instruments"] });
      qc.invalidateQueries({ queryKey: ["feed"] });
    },
    "instrument.removed": () => qc.invalidateQueries({ queryKey: ["instruments"] }),
    "pulse.updated": () => qc.invalidateQueries({ queryKey: ["pulse-bar"] }),
    "alert.fired": (data: unknown) => {
      const e = data as AlertFiredEvent;
      qc.invalidateQueries({ queryKey: ["inbox"] });
      notify(`◉ ${e.entity.symbol ?? "MARKET"} · ${e.alert.name}`, {
        body: e.article.thesisImpact || e.article.title,
        tag: `alert-${e.alert.id}`,
      });
    },
  });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "/") return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const search = document.querySelector<HTMLInputElement>("input[data-search-input]");
      if (search) {
        e.preventDefault();
        search.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-zinc-100">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-zinc-800 bg-zinc-900/60 px-3 py-2 backdrop-blur sm:px-4 md:flex-nowrap">
        <Link to="/" className="flex items-baseline gap-2 text-zinc-100 hover:text-[var(--color-accent)]">
          <Activity className="size-4 text-[var(--color-accent)]" />
          <h1 className="text-sm font-semibold tracking-tight">
            India Market Monitor
          </h1>
        </Link>

        <nav className="order-3 -mx-1 flex items-center gap-0.5 overflow-x-auto text-sm md:order-none md:mx-2">
          {NAV.map(({ to, end, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition",
                  isActive ? "bg-zinc-800/80 text-zinc-100" : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
                )
              }
            >
              <Icon className="size-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 text-[11px] text-zinc-400">
          <div className="hidden sm:block">
            <SearchBar />
          </div>
          <span className="mx-1 hidden text-zinc-700 md:inline">·</span>
          <span className="hidden items-center gap-1 md:flex" title={stats?.aiEnabled ? "Local Claude scoring active" : "AI scoring off"}>
            <Circle className={cn("size-2 fill-current", stats?.aiEnabled ? "text-[var(--color-bull)]" : "text-zinc-600")} />
            <Sparkles className="size-3" />
            <span>AI {stats?.aiEnabled ? "on" : "off"}</span>
          </span>
          <span className="hidden text-zinc-700 md:inline">·</span>
          <span className="font-mono text-zinc-300" title={`${stats?.instruments ?? 0} stocks · ${stats?.scored ?? 0} scored`}>
            {pluralize(stats?.articles, "item")}
          </span>
          <button
            onClick={() => api.pollNow()}
            className="ml-1 flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-300 hover:border-zinc-700 hover:text-[var(--color-accent)]"
            title="Poll all sources now"
          >
            <RefreshCw className="size-3" />
          </button>
        </div>
      </header>

      <MarketPulseBar />

      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
