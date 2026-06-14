import { useMemo } from "react";
import FeedCard from "./FeedCard";
import type { Density, FeedRow } from "@/lib/types";
import { dayBucketLabel, dayKey, pluralize } from "@/lib/format";

interface Props {
  items: FeedRow[];
  labels: Record<string, string>;
  density: Density;
  onSourceClick?: (source: string) => void;
}

interface DayGroup {
  key: string;
  label: string;
  items: FeedRow[];
}

function groupByDay(items: FeedRow[]): DayGroup[] {
  const order: string[] = [];
  const map: Record<string, DayGroup> = {};
  for (const row of items) {
    const ts = row.article.publishedAt ?? row.article.ingestedAt;
    const key = dayKey(ts);
    if (!map[key]) {
      map[key] = { key, label: dayBucketLabel(ts), items: [] };
      order.push(key);
    }
    map[key]!.items.push(row);
  }
  return order.map((k) => map[k]!);
}

export default function FeedList({ items, labels, density, onSourceClick }: Props) {
  const grouped = useMemo(() => groupByDay(items), [items]);
  return (
    <div className="space-y-4">
      {grouped.map((g) => (
        <section key={g.key}>
          <header className="sticky top-0 z-[5] -mx-3 mb-2 flex items-baseline justify-between border-b border-zinc-800 bg-zinc-950/85 px-3 py-1 backdrop-blur sm:-mx-4 sm:px-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-[1.5px] text-zinc-400">{g.label}</h3>
            <span className="text-[10px] text-zinc-600">{pluralize(g.items.length, "item")}</span>
          </header>
          <ul
            className={
              density === "compact"
                ? "grid gap-1.5 lg:grid-cols-2 2xl:grid-cols-3 3xl:grid-cols-4"
                : "grid gap-2 lg:grid-cols-2 2xl:grid-cols-3 3xl:grid-cols-4"
            }
          >
            {g.items.map((row) => (
              <li key={row.article.id} className="animate-slide-in">
                <FeedCard
                  article={row.article}
                  instrument={row.instrument}
                  sourceLabel={labels[row.article.source] ?? row.article.source}
                  density={density}
                  onSourceClick={onSourceClick}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
