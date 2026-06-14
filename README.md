<div align="center">

# 📈 India Market Monitor

### A Bloomberg-style terminal for Indian equities — running entirely on your own machine.

**Every filing, every insider trade, every regulator action, and the whole financial press — in one fast, AI-scored feed.**

`NSE` · `BSE` · `SEBI` · `Economic Times` · `Mint` · `Moneycontrol` · `NDTV Profit` · `Reuters` · `BusinessLine` · `Reddit`

![status](https://img.shields.io/badge/status-production--ready-2ea44f)
![stack](https://img.shields.io/badge/React_19-Hono-blue)
![db](https://img.shields.io/badge/SQLite-local--first-003B57)
![ai](https://img.shields.io/badge/AI-local_Claude_CLI-d97706)
![cost](https://img.shields.io/badge/cost-%E2%82%B90_%2F_no_API_keys-success)
![license](https://img.shields.io/badge/license-MIT-lightgrey)

<br>

<a href="docs/demo.mp4"><img src="docs/demo.gif" alt="India Market Monitor — live demo" width="860"></a>

<sub>▶ <a href="docs/demo.mp4"><b>Watch the full-quality demo</b></a> · click the preview above</sub>

</div>

---

## The problem

If you trade Indian equities, your edge dies a death of a thousand tabs. The board-meeting
notice is on NSE. The promoter just sold on the BSE insider page. SEBI passed an order after
hours. The story already broke on Moneycontrol, got a different spin on ET, and a sharper one
on NDTV Profit. FII/DII flows landed at 5:30pm. By the time you've checked all of it, the move
is over — and half of those sites block scrapers, so you can't even automate it.

**India Market Monitor collapses all of that into a single live terminal**, ranks every item by
how much it actually matters to *your* watchlist using a local AI analyst, and de-duplicates the
same story across five outlets into one card. No API keys. No cloud. No monthly bill. It runs on
your laptop.

---

## What you get

### 🟢 The hard signal, first
- **NSE Corporate Announcements** — board meetings, results, LODR Reg-30 material events, fund raising. The SEC-EDGAR of India.
- **NSE Insider / PIT** — promoter & insider buys, sells and pledges (SEBI PIT Reg-7). The trades that move before the news does.
- **SEBI** — orders, circulars, settlement & prohibitory orders, straight from the regulator.
- **BSE Announcements** — complements NSE and covers BSE-only listings.

### 📰 The entire financial press — without scraping it
One Google-News-India query per stock pulls coverage from **Moneycontrol, Economic Times, Mint,
Business Standard, NDTV Profit, CNBC-TV18, BusinessLine, Reuters and Financial Express** in a single
feed. Most of those sites block bots — this is how you reach them all, reliably.

### 🌏 The top-down picture — **Market Pulse**
A live command strip and dashboard with **NIFTY 50 / Bank Nifty / Next 50 / India VIX** (with P/E & P/B),
a **sector heatmap**, and **daily FII/DII cash-market flows** — pulled straight from NSE.

### ⚖️ **Regulatory Radar**
A dedicated, noise-free view of just the hard disclosures — exchange filings, insider trades, and SEBI
actions — for when you only want signal.

### 🧠 A local AI analyst on every item
Each headline is scored 0–10 for **relevance to the specific company**, tagged **bullish / bearish / neutral**,
categorised (filing / insider / results / regulatory / macro / rating…), and given a one-line **thesis impact**.
It understands the Indian context — LODR, promoter & FII holdings, rating actions (CRISIL/ICRA/CARE), block
deals, results-vs-estimates — and **collapses the same event from many outlets into one card**. All of it runs
through your local `claude` CLI: **no API key, nothing leaves your machine.**

### 📥 Bring your own inbox — email monitoring (IMAP)
Point the monitor at any inbox you route alerts into — **NSE/BSE filing mailers, broker & PMS notices, exchange
digests, paid research newsletters, Google Alerts**. New mail is parsed, AI-scored, and auto-routed to the stock
it mentions (or kept market-wide). Read-only — your mailbox is never touched. Connect it from the **Sources** tab
with a built-in "test connection" check.

### 🔔 Alerts that respect your time
Fire on desktop, webhook (Slack/Discord/Telegram-relay), or log when a *scored, non-duplicate* item clears
your bar — scoped to `all`, `market`, or a specific list like `RELIANCE,TCS`.

---

## At a glance

| | |
|---|---|
| 🗂️ **Watchlist** | Sector-grouped, resolved from the full NSE + BSE master (joined on ISIN). |
| ⚡ **Real-time** | Server-Sent Events — new items and AI scores stream in without a refresh. |
| 🔎 **Full-text search** | Instant SQLite FTS5 across every stored title, summary and thesis. |
| 📊 **Per-stock detail** | 30-day sentiment trend, source & category breakdown, full timeline. |
| 🧩 **Custom feeds** | Add any RSS/Atom (your favourite analyst's Substack, a broker feed). |
| 💸 **Cost** | ₹0. No paid APIs, no cloud, no keys. |

---

## Quickstart

```bash
git clone <this-repo> india-market-monitor
cd india-market-monitor
npm install
npm run dev
```

Open **http://localhost:5173**, then add stocks — `RELIANCE`, `TCS`, `HDFCBANK`, `INFY`, `TATAMOTORS`, `ZOMATO`.

> **AI scoring** turns on automatically if the [`claude` CLI](https://docs.claude.com/en/docs/claude-code) is on your
> PATH. Without it the app still ingests and displays everything — it just skips relevance/sentiment/dedup.

That's it. The scheduler starts polling immediately (full ingest every 5 min, Market Pulse every 90s).

---

## How it's built

```
react 19 + vite + tailwind v4        ← terminal UI (watchlist · pulse · radar · search · alerts)
        │  TanStack Query · SSE · Recharts
        ▼
   hono (node) api  ──────────────►  better-sqlite3  (single local file)
        │                                  ▲
        │  source registry                 │ AI scores + cross-source dedup
        ▼                                  │
  instrument sources ┐            ┌── local `claude` CLI analyst
  market sources     ┼─ ingest ───┤
  custom RSS         ┘            └── alerts (desktop / webhook / log)
```

| Layer | Tech |
|---|---|
| Frontend | React 19 · Vite · TypeScript · Tailwind v4 · TanStack Query · React Router · Recharts |
| Backend | Hono on Node · Drizzle ORM · better-sqlite3 |
| Real-time | Server-Sent Events |
| AI | `claude -p` subprocess — no API key |
| Storage | One SQLite file at `data/monitor.db` |

**Design highlights:** a first-class split between **per-stock** and **market-wide** sources; partial unique
indexes that de-dup each scope correctly; an Akamai-aware NSE client that warms its own cookie session; and a
fail-soft ingest where any single source erroring never breaks a cycle.

### Configuration

| Env var | Default | Purpose |
|---|---|---|
| `PORT` | `3001` | API port |
| `POLL_INTERVAL_SECONDS` | `300` | Full ingest cadence |
| `PULSE_INTERVAL_SECONDS` | `90` | Market-Pulse refresh cadence |

---

## Source roster

| Tier | Source | Scope |
|---|---|---|
| **1 · Official** | NSE Corporate Announcements | per-stock |
| **1 · Official** | NSE Insider / PIT | per-stock |
| **1 · Official** | SEBI (orders, circulars, press) | market |
| **1 · Official** | BSE Announcements *(best-effort)* | per-stock |
| **2 · Press** | Google News India (aggregates the entire press) | per-stock |
| **2 · Macro** | Macro Radar (RBI, inflation, FII/DII, rupee/crude, Budget) | market |
| **2 · Press** | Economic Times · Mint · BusinessLine | market |
| **3 · Social** | Reddit (r/IndiaInvestments, r/DalalStreetTalks) *(best-effort)* | market |
| **+** | Your own custom RSS/Atom feeds | market / per-stock |
| **+** | Your own email inbox via **IMAP** (broker/exchange/newsletter alerts) | market / per-stock |

> *Best-effort sources (BSE, Reddit) depend on your network — some endpoints rate-limit datacenter IPs and
> work best from a normal connection. They fail silently and never block a cycle; NSE covers the filing signal
> meanwhile.*

---

## Roadmap

- [ ] Concall-transcript & annual-report ingestion
- [ ] Credit-rating-action source (CRISIL / ICRA / CARE / India Ratings)
- [ ] Bulk/block-deal feed in Market Pulse
- [ ] Options OI & F&O ban-list signals
- [ ] One-command Docker deploy

---

## License

MIT — use it, fork it, build on it.

<div align="center">
<sub>Built for people who live in the market. Local-first. Yours.</sub>
</div>
