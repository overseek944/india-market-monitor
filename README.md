# India Market Monitor

A production-grade **local** news, filings & macro terminal for Indian equities — built for someone who lives in the market and wants every high-signal source in one fast, AI-scored feed. No paid APIs, no cloud, no keys. AI thesis-scoring runs through your local `claude` CLI.

It is the spiritual successor to the US News Monitor, rebuilt from the ground up for Dalal Street: a first-class split between **per-stock** and **market-wide** sources, a live **Market Pulse** (indices + sector breadth + FII/DII flows), a **Regulatory Radar** for hard-signal filings, and an analyst tuned for SEBI/RBI/NSE/BSE context.

## Run

```bash
cd india-market-monitor
npm install            # root + api + web workspaces
npm run dev            # api on :3001, web on :5173
```

Open <http://localhost:5173>, then add stocks (RELIANCE, TCS, HDFCBANK, INFY…).

> AI scoring is automatic if the `claude` CLI is on your PATH. Without it the app still
> ingests and displays everything — it just skips relevance/sentiment/dedup.

## Why these sources (and not spam)

| Tier | Source | What it gives you |
| --- | --- | --- |
| **1 · Official** | **NSE Corporate Announcements** | The primary disclosure stream — board meetings, results, LODR Reg-30 material events, fund raising. The SEC-EDGAR of India. |
| **1 · Official** | **BSE Corporate Announcements** | Complements NSE; covers BSE-only listings. |
| **1 · Official** | **NSE Insider / PIT** | Promoter & insider buys, sells and pledges (SEBI PIT Reg-7). High-conviction signal rarely in the press. |
| **1 · Official** | **SEBI** | Orders, circulars, settlement & prohibitory orders, press releases — straight from the regulator. |
| **2 · Press** | **Google News (India)** | One query per stock pulls the *entire* Indian financial press — Moneycontrol, ET, Mint, Business Standard, NDTV Profit, CNBC-TV18, BusinessLine, Reuters, Financial Express. Most of those block direct scraping; this reaches them all. |
| **2 · Macro** | **Macro Radar** | RBI policy & rates, inflation prints, FII/DII flows, rupee/crude, Budget/fiscal. |
| **2 · Press** | **Economic Times / Mint / BusinessLine** | Fresh, scrape-friendly market desks (market-wide). |
| **3 · Social** | **Reddit (India)** | r/IndiaInvestments + r/DalalStreetTalks — the substantive subs only, meme subs deliberately excluded. |

Plus **custom RSS** for anything else you trust (an analyst's Substack, a broker feed).

The famously bot-blocked outlets (Moneycontrol, NDTV Profit, Business Standard) are reached
**per stock via Google News** rather than scraped — you still get their coverage, reliably.

## What's new vs. the US monitor

- **Instrument vs. market source taxonomy** — market-wide signals (SEBI/RBI/flows) are first-class, not bolted on.
- **Market Pulse** — live NIFTY / Bank Nifty / Next 50 / India VIX, a sector heatmap, and daily FII/DII cash-market flows, straight from NSE.
- **Regulatory Radar** — a dedicated view for exchange filings + insider trades + SEBI actions, separated from news noise.
- **Sector-grouped watchlist** — instruments grouped by NSE industry classification.
- **India-tuned AI analyst** — understands LODR, PIT, promoter/FII holdings, rating actions, block deals, results-vs-estimates.
- **AI cross-source dedup** — the same event from five outlets collapses to one card.

## Stack

| Layer | Tech |
| --- | --- |
| Frontend | React 19 · Vite · TypeScript · Tailwind v4 · TanStack Query · React Router · Recharts |
| Backend | Hono on Node · Drizzle ORM · better-sqlite3 |
| Real-time | Server-Sent Events |
| Scheduler | In-process intervals (ingest + faster Market-Pulse tick) |
| AI | `claude -p` subprocess (no API key) |
| Storage | SQLite single file at `data/monitor.db` + cached instrument master |

## Data model

- **instruments** — your watchlist; resolved from NSE's `EQUITY_L.csv` joined to BSE scrip codes on ISIN, sector-tagged from the Nifty-500 industry list.
- **articles** — per-stock *or* market-wide (`instrument_id IS NULL`), AI-scored, cross-source de-duplicated.
- **market_snapshots** — latest indices + FII/DII payloads for Market Pulse.
- **alerts / alert_log** — fire on scored, non-duplicate items via desktop / webhook / log.

## Configuration (env vars read by `api/`)

| Var | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3001` | API port |
| `POLL_INTERVAL_SECONDS` | `300` | Full ingest cycle cadence |
| `PULSE_INTERVAL_SECONDS` | `90` | Market-Pulse (indices + FII/DII) refresh cadence |

## Notes on Indian endpoints

- **NSE** APIs sit behind Akamai; the client warms a cookie session and retries. Works from a normal network; some endpoints can be flaky and degrade gracefully.
- **Reddit** rate-limits datacenter IPs — best-effort, contributes when run from a normal connection.
- All sources are **fail-soft**: one source erroring never breaks an ingest cycle.

This is a personal, local-first tool. Be considerate with poll intervals — these are free public endpoints.
