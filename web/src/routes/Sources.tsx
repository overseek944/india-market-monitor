import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Rss, Trash2, Power, Mail, Loader2, Check, X } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";
import type { SourceMeta } from "@/lib/types";

const TIER_LABEL: Record<number, string> = {
  1: "Tier 1 · Official & Regulatory",
  2: "Tier 2 · Press & Macro",
  3: "Tier 3 · Social & Sentiment",
};

export default function Sources() {
  const qc = useQueryClient();
  const { data: builtin = [] } = useQuery({ queryKey: ["builtin-sources"], queryFn: api.builtinSources });
  const { data: custom = [] } = useQuery({ queryKey: ["custom-sources"], queryFn: api.customSources });

  const [form, setForm] = useState({ name: "", url: "", scope: "all" });
  const add = useMutation({
    mutationFn: () => api.addRssSource({ name: form.name.trim(), url: form.url.trim(), scope: form.scope.trim() || "all" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["custom-sources"] });
      qc.invalidateQueries({ queryKey: ["source-labels"] });
      setForm({ name: "", url: "", scope: "all" });
    },
  });
  const toggle = useMutation({
    mutationFn: (id: number) => api.toggleCustomSource(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["custom-sources"] }),
  });
  const del = useMutation({
    mutationFn: (id: number) => api.deleteCustomSource(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["custom-sources"] }),
  });

  const tiers = [1, 2, 3].map((tier) => ({ tier, sources: builtin.filter((s) => s.tier === tier) }));

  return (
    <div className="h-full overflow-y-auto px-3 py-4 sm:px-5">
      <h2 className="mb-1 text-base font-semibold text-zinc-100">Sources</h2>
      <p className="mb-4 text-[12px] text-zinc-500">
        Every built-in source is curated for the Indian market — official exchange/regulator feeds first, then the
        quality financial press, then social. No spam, no pump channels.
      </p>

      {tiers.map(({ tier, sources }) =>
        sources.length === 0 ? null : (
          <div key={tier} className="mb-4">
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[1.5px] text-zinc-400">{TIER_LABEL[tier]}</h3>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {sources.map((s) => (
                <SourceCard key={s.name} s={s} />
              ))}
            </div>
          </div>
        )
      )}

      <div className="mt-6 max-w-2xl">
        <h3 className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[1.5px] text-zinc-400">
          <Rss className="size-3.5" /> Custom RSS feeds
        </h3>
        <p className="mb-2 text-[12px] text-zinc-500">
          Add any RSS/Atom feed (a favourite analyst’s Substack, a broker research feed, a sector blog). Items are
          AI-scored and land in Market Pulse.
        </p>
        <div className="flex flex-wrap gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Feed name"
            className="min-w-[8rem] flex-1 rounded-md border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:border-[var(--color-accent)] focus:outline-none"
          />
          <input
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            placeholder="https://…/feed.xml"
            className="min-w-[12rem] flex-[2] rounded-md border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:border-[var(--color-accent)] focus:outline-none"
          />
          <button
            onClick={() => add.mutate()}
            disabled={add.isPending || !form.name.trim() || !form.url.trim()}
            className="flex items-center gap-1.5 rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-[13px] font-semibold text-zinc-950 hover:brightness-110 disabled:opacity-50"
          >
            <Plus className="size-4" /> Add
          </button>
        </div>

        <div className="mt-2 space-y-1.5">
          {custom.map((cs) => {
            let subtitle = "";
            try {
              const cfg = JSON.parse(cs.configJson);
              subtitle =
                cs.kind === "imap"
                  ? `✉ ${cfg.username ?? cfg.host ?? "inbox"} · ${cfg.folder ?? "INBOX"} · scope: ${cs.scope}`
                  : cfg.url ?? "";
            } catch {
              /* ignore */
            }
            return (
              <div key={cs.id} className="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900/40 px-3 py-2">
                <Power className={cn("size-4", cs.enabled ? "text-[var(--color-bull)]" : "text-zinc-600")} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-zinc-200">{cs.name}</div>
                  <div className="truncate text-[11px] text-zinc-600">{subtitle}</div>
                </div>
                <button onClick={() => toggle.mutate(cs.id)} className="text-[11px] text-zinc-500 hover:text-zinc-300">
                  {cs.enabled ? "Disable" : "Enable"}
                </button>
                <button onClick={() => del.mutate(cs.id)} className="text-zinc-600 hover:text-[var(--color-bear)]">
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <EmailSource />
    </div>
  );
}

function EmailSource() {
  const qc = useQueryClient();
  const [f, setF] = useState({
    name: "",
    host: "",
    port: 993,
    username: "",
    password: "",
    folder: "INBOX",
    scope: "all",
  });
  const [test, setTest] = useState<{ state: "idle" | "ok" | "err"; msg: string }>({ state: "idle", msg: "" });

  const payload = () => ({
    name: f.name.trim(),
    host: f.host.trim(),
    port: f.port,
    username: f.username.trim(),
    password: f.password,
    folder: f.folder.trim() || "INBOX",
    scope: f.scope.trim() || "all",
  });

  const testConn = useMutation({
    mutationFn: () => api.testImapSource(payload()),
    onSuccess: (r) =>
      setTest(r.ok ? { state: "ok", msg: `Connected · ${r.messages ?? 0} messages in folder` } : { state: "err", msg: r.error ?? "failed" }),
    onError: (e) => setTest({ state: "err", msg: (e as Error).message }),
  });
  const add = useMutation({
    mutationFn: () => api.addImapSource(payload()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["custom-sources"] });
      qc.invalidateQueries({ queryKey: ["source-labels"] });
      setF((s) => ({ ...s, name: "", password: "" }));
      setTest({ state: "idle", msg: "" });
    },
  });

  const canSubmit = f.name.trim() && f.host.trim() && f.username.trim() && f.password;
  const input =
    "rounded-md border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:border-[var(--color-accent)] focus:outline-none";

  return (
    <div className="mt-6 max-w-2xl">
      <h3 className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[1.5px] text-zinc-400">
        <Mail className="size-3.5" /> Email inbox (IMAP)
      </h3>
      <p className="mb-2 text-[12px] text-zinc-500">
        Point the monitor at an inbox you route alerts into — NSE/BSE filing mailers, broker/PMS notices,
        exchange digests, paid research newsletters, Google Alerts. New mail is parsed, AI-scored, and (with
        scope <code className="text-zinc-400">all</code>) auto-routed to the stock it mentions. Read-only — your
        mailbox is never modified.
      </p>

      <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
        <div className="grid grid-cols-2 gap-2">
          <input className={input} placeholder="Label (e.g. Broker alerts)" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <input
            className={input}
            placeholder="Scope: all / market / RELIANCE,TCS"
            value={f.scope}
            onChange={(e) => setF({ ...f, scope: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <input className={cn(input, "col-span-2")} placeholder="IMAP host (e.g. imap.gmail.com)" value={f.host} onChange={(e) => setF({ ...f, host: e.target.value })} />
          <input className={input} type="number" placeholder="Port" value={f.port} onChange={(e) => setF({ ...f, port: parseInt(e.target.value, 10) || 993 })} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input className={input} placeholder="Username / email" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} autoComplete="off" />
          <input className={input} type="password" placeholder="Password / app password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="new-password" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input className={input} placeholder="Folder (default INBOX)" value={f.folder} onChange={(e) => setF({ ...f, folder: e.target.value })} />
          <div className="flex gap-2">
            <button
              onClick={() => testConn.mutate()}
              disabled={testConn.isPending || !canSubmit}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-[13px] font-medium text-zinc-300 hover:text-[var(--color-accent)] disabled:opacity-50"
            >
              {testConn.isPending ? <Loader2 className="size-4 animate-spin" /> : null} Test
            </button>
            <button
              onClick={() => add.mutate()}
              disabled={add.isPending || !canSubmit}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-[13px] font-semibold text-zinc-950 hover:brightness-110 disabled:opacity-50"
            >
              <Plus className="size-4" /> Add
            </button>
          </div>
        </div>
        {test.state !== "idle" && (
          <div
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px]",
              test.state === "ok" ? "bg-emerald-950/40 text-[var(--color-bull)]" : "bg-rose-950/40 text-[var(--color-bear)]"
            )}
          >
            {test.state === "ok" ? <Check className="size-3.5" /> : <X className="size-3.5" />}
            {test.msg}
          </div>
        )}
        <p className="text-[11px] text-zinc-600">
          Gmail/Outlook need an <strong>app password</strong> (2FA must be on). Credentials are stored locally in
          your SQLite DB and never sent anywhere except your mail server.
        </p>
      </div>
    </div>
  );
}

function SourceCard({ s }: { s: SourceMeta }) {
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-900/40 p-3">
      <div className="flex items-center gap-2">
        <span className={cn("size-2 rounded-full", s.enabled ? "bg-[var(--color-bull)]" : "bg-zinc-600")} />
        <span className="text-[13px] font-semibold text-zinc-100">{s.label}</span>
        <span className="ml-auto rounded bg-zinc-800/60 px-1.5 py-0.5 text-[10px] uppercase text-zinc-500">{s.scope}</span>
      </div>
      <p className="mt-1 text-[11.5px] leading-snug text-zinc-500">{s.description}</p>
      <div className="mt-1.5 text-[10px] text-zinc-600">
        {formatNumber(s.count ?? 0)} stored · {s.category}
      </div>
    </div>
  );
}
