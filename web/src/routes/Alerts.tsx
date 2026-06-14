import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BellOff, Plus, Trash2, Inbox } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { timeAgo, titleCase } from "@/lib/format";
import { useSSE } from "@/hooks/useSSE";

const CHANNELS = ["desktop", "log", "webhook"] as const;

export default function Alerts() {
  const qc = useQueryClient();
  const { data: alerts = [] } = useQuery({ queryKey: ["alerts"], queryFn: api.listAlerts });
  const { data: inbox } = useQuery({ queryKey: ["inbox"], queryFn: api.inbox, refetchInterval: 30_000 });
  useSSE({ "alert.fired": () => qc.invalidateQueries({ queryKey: ["inbox"] }) });

  const [form, setForm] = useState({
    name: "",
    scope: "all",
    minRelevance: 7,
    sentimentFilter: "",
    categoryFilter: "",
    channel: "desktop" as (typeof CHANNELS)[number],
    webhookUrl: "",
  });

  const create = useMutation({
    mutationFn: () =>
      api.addAlert({
        name: form.name.trim() || "Untitled alert",
        scope: form.scope.trim() || "all",
        minRelevance: form.minRelevance,
        sentimentFilter: form.sentimentFilter || null,
        categoryFilter: form.categoryFilter || null,
        channel: form.channel,
        webhookUrl: form.webhookUrl || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alerts"] });
      setForm((f) => ({ ...f, name: "", webhookUrl: "" }));
    },
  });
  const toggle = useMutation({
    mutationFn: (id: number) => api.toggleAlert(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts"] }),
  });
  const del = useMutation({
    mutationFn: (id: number) => api.deleteAlert(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts"] }),
  });

  const inboxItems = inbox?.items ?? [];

  return (
    <div className="h-full overflow-y-auto px-3 py-4 sm:px-5">
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Create + manage */}
        <div>
          <h2 className="mb-2 flex items-center gap-2 text-base font-semibold text-zinc-100">
            <Bell className="size-4 text-[var(--color-accent)]" /> Alerts
          </h2>
          <p className="mb-3 text-[12px] text-zinc-500">
            Get pinged when a scored, non-duplicate item clears your bar. Scope to <code className="text-zinc-400">all</code>,{" "}
            <code className="text-zinc-400">market</code>, or a comma list like <code className="text-zinc-400">RELIANCE,TCS</code>.
          </p>

          <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Alert name (e.g. High-impact filings)"
              className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:border-[var(--color-accent)] focus:outline-none"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                value={form.scope}
                onChange={(e) => setForm({ ...form, scope: e.target.value })}
                placeholder="Scope: all / market / RELIANCE,TCS"
                className="rounded-md border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:border-[var(--color-accent)] focus:outline-none"
              />
              <label className="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-[12px] text-zinc-400">
                Min rel
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={form.minRelevance}
                  onChange={(e) => setForm({ ...form, minRelevance: parseInt(e.target.value, 10) || 0 })}
                  className="w-12 bg-transparent font-mono text-zinc-100 focus:outline-none"
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={form.sentimentFilter}
                onChange={(e) => setForm({ ...form, sentimentFilter: e.target.value })}
                className="rounded-md border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-[13px] text-zinc-300 focus:outline-none"
              >
                <option value="">Any sentiment</option>
                <option value="bullish">Bullish only</option>
                <option value="bearish">Bearish only</option>
              </select>
              <input
                value={form.categoryFilter}
                onChange={(e) => setForm({ ...form, categoryFilter: e.target.value })}
                placeholder="Categories: filing,insider"
                className="rounded-md border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:border-[var(--color-accent)] focus:outline-none"
              />
            </div>
            <div className="flex gap-2">
              {CHANNELS.map((ch) => (
                <button
                  key={ch}
                  onClick={() => setForm({ ...form, channel: ch })}
                  className={cn(
                    "flex-1 rounded-md px-2 py-1.5 text-[12px] font-medium capitalize transition",
                    form.channel === ch ? "bg-[var(--color-accent)] text-zinc-950" : "bg-zinc-950 text-zinc-400 ring-1 ring-zinc-800"
                  )}
                >
                  {ch}
                </button>
              ))}
            </div>
            {form.channel === "webhook" && (
              <input
                value={form.webhookUrl}
                onChange={(e) => setForm({ ...form, webhookUrl: e.target.value })}
                placeholder="https://your-webhook-url (Slack/Discord/Telegram-relay)"
                className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:border-[var(--color-accent)] focus:outline-none"
              />
            )}
            <button
              onClick={() => create.mutate()}
              disabled={create.isPending}
              className="flex w-full items-center justify-center gap-1.5 rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-[13px] font-semibold text-zinc-950 hover:brightness-110 disabled:opacity-50"
            >
              <Plus className="size-4" /> Create alert
            </button>
          </div>

          <div className="mt-3 space-y-1.5">
            {alerts.length === 0 ? (
              <p className="py-4 text-center text-[12px] text-zinc-600">No alerts yet.</p>
            ) : (
              alerts.map((a) => (
                <div key={a.id} className="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900/40 px-3 py-2">
                  <button onClick={() => toggle.mutate(a.id)} title={a.enabled ? "Disable" : "Enable"}>
                    {a.enabled ? <Bell className="size-4 text-[var(--color-bull)]" /> : <BellOff className="size-4 text-zinc-600" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium text-zinc-200">{a.name}</div>
                    <div className="text-[11px] text-zinc-500">
                      {a.scope} · ≥{a.minRelevance}
                      {a.sentimentFilter ? ` · ${a.sentimentFilter}` : ""}
                      {a.categoryFilter ? ` · ${a.categoryFilter}` : ""} · {a.channel}
                    </div>
                  </div>
                  <button onClick={() => del.mutate(a.id)} className="text-zinc-600 hover:text-[var(--color-bear)]">
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Inbox */}
        <div>
          <h2 className="mb-2 flex items-center gap-2 text-base font-semibold text-zinc-100">
            <Inbox className="size-4 text-[var(--color-accent)]" /> Inbox
          </h2>
          <p className="mb-3 text-[12px] text-zinc-500">Most recent alert fires.</p>
          <div className="space-y-1.5">
            {inboxItems.length === 0 ? (
              <p className="py-4 text-center text-[12px] text-zinc-600">No fires yet.</p>
            ) : (
              inboxItems.map((row) => (
                <a
                  key={row.log.id}
                  href={row.article.url}
                  target="_blank"
                  rel="noopener"
                  className="block rounded-md border border-zinc-800 bg-zinc-900/40 px-3 py-2 hover:border-zinc-700"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] font-bold text-[var(--color-accent)]">
                      {row.instrument?.symbol ?? "MARKET"}
                    </span>
                    <span className="rounded bg-zinc-800/60 px-1.5 py-0.5 text-[10px] text-zinc-400">{row.alert.name}</span>
                    {row.article.category && <span className="text-[10px] text-zinc-600">{titleCase(row.article.category)}</span>}
                    <span className="ml-auto text-[10px] text-zinc-600">{timeAgo(row.log.firedAt)}</span>
                  </div>
                  <div className="mt-1 line-clamp-2 text-[12.5px] text-zinc-300">{row.article.thesisImpact || row.article.title}</div>
                </a>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
