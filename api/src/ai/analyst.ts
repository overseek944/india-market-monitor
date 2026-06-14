import { spawn } from "node:child_process";

export const PER_ENTITY_SCORE_CAP = 12;
const MAX_CONCURRENT = 2;
const CLAUDE_TIMEOUT_MS = 45_000;

export interface RecentCandidate {
  id: number;
  title: string;
  thesisImpact: string | null;
  sentiment: string | null;
}

const SCHEMA =
  "Schema: " +
  '{"relevance": int 0-10, "sentiment": "bullish"|"bearish"|"neutral", ' +
  '"category": "filing"|"earnings"|"insider"|"orders"|"management"|"regulatory"|"macro"|"rating"|"competitor"|"rumor"|"analyst"|"product"|"other", ' +
  '"thesis_impact": string (one sentence on why this matters to an investor; "no thesis impact" if irrelevant), ' +
  '"novelty": int 0-10, ' +
  '"duplicate_of": null OR int 1-N (see DUPLICATE DETECTION)}';

const DUP_RULES =
  "DUPLICATE DETECTION:\n" +
  'If "recent items" are provided, judge whether this NEW item reports the SAME UNDERLYING EVENT as any of them (same factual development, same period, same outcome, broadly same take — even if a different publisher/wording).\n' +
  'If it duplicates recent item #N, return "duplicate_of": N (1-based). If genuinely new/distinct, return null.\n' +
  "DIFFERENT sentiments on the same topic (a bullish vs a bearish take) are NOT duplicates.";

const INSTRUMENT_PREAMBLE =
  "You are a senior equity research analyst covering Indian listed companies (NSE/BSE). " +
  "Score each item for an investor in the named company AND judge duplication. " +
  "Context that matters in India: SEBI/RBI regulation, LODR Reg-30 disclosures, promoter & FII/DII holdings, " +
  "insider/PIT transactions, credit-rating actions (CRISIL/ICRA/CARE/India Ratings), block/bulk deals, " +
  "quarterly results vs estimates, order wins, pledged shares, and sector cycles. " +
  "Reply with STRICT JSON only — no prose, no markdown fences.\n\n" +
  SCHEMA +
  "\n\nrelevance=0 if the item is not actually about the company.\n\n" +
  DUP_RULES;

const MARKET_PREAMBLE =
  "You are a senior markets strategist covering Indian equities. " +
  "Score each item for how much it matters to an investor tracking the broad Indian market (Nifty/Sensex), " +
  "and judge duplication. High relevance = RBI policy/rates, inflation & macro data, FII/DII flows, the rupee, " +
  "crude, Budget/fiscal/tax changes, major SEBI actions, and index-moving sector news. " +
  "Low relevance = single-stock trivia, ads, listicles, generic 'top 5 stocks to buy' churn. " +
  "Reply with STRICT JSON only — no prose, no markdown fences.\n\n" +
  SCHEMA +
  "\n\n" +
  DUP_RULES;

function recentsBlock(label: string, recents: RecentCandidate[]): string {
  if (recents.length === 0) return "";
  return (
    `\nRecent items for ${label} (1-based index for "duplicate_of"):\n` +
    recents
      .map((r, i) => {
        const ti = (r.thesisImpact ?? "").trim().slice(0, 160);
        const sentTag = r.sentiment ? ` [${r.sentiment}]` : "";
        return `  ${i + 1}.${sentTag} ${r.title}${ti ? ` — ${ti}` : ""}`;
      })
      .join("\n") +
    "\n"
  );
}

export interface ScoreArgs {
  mode: "instrument" | "market";
  /** symbol+name for instrument mode; a topic label for market mode. */
  symbol: string;
  name: string | null;
  title: string;
  description: string | null;
  source: string;
  recentArticles?: RecentCandidate[];
}

function buildPrompt(args: ScoreArgs): string {
  const preamble = args.mode === "instrument" ? INSTRUMENT_PREAMBLE : MARKET_PREAMBLE;
  const desc = (args.description ?? "").trim().slice(0, 1200);
  const recents = args.recentArticles ?? [];
  const label = args.mode === "instrument" ? args.symbol : "the Indian market";
  const entityLine =
    args.mode === "instrument"
      ? `Company: ${args.symbol}${args.name ? ` (${args.name})` : ""}\n`
      : `Scope: broad Indian market\n`;
  return (
    `${preamble}\n\n` +
    entityLine +
    `Source: ${args.source}\n` +
    `Title: ${args.title}\n` +
    `Description: ${desc}\n` +
    recentsBlock(label, recents) +
    "\nRespond with JSON only."
  );
}

function stripFences(text: string): string {
  let t = text.trim();
  if (t.startsWith("```")) {
    const firstNl = t.indexOf("\n");
    if (firstNl !== -1) t = t.slice(firstNl + 1);
    if (t.trimEnd().endsWith("```")) t = t.trimEnd().slice(0, -3).trim();
  }
  return t.trim();
}

class Semaphore {
  private permits: number;
  private waiters: Array<() => void> = [];
  constructor(n: number) {
    this.permits = n;
  }
  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }
    await new Promise<void>((resolve) => this.waiters.push(resolve));
    this.permits--;
  }
  release(): void {
    this.permits++;
    const next = this.waiters.shift();
    if (next) next();
  }
}

const sem = new Semaphore(MAX_CONCURRENT);

export interface ArticleScore {
  relevance: number;
  sentiment: string;
  category: string;
  thesisImpact: string;
  novelty: number;
  duplicateOfIndex: number | null;
}

async function runClaude(prompt: string): Promise<string | null> {
  return new Promise((resolve) => {
    const proc = spawn(
      "claude",
      ["-p", prompt, "--model", "claude-haiku-4-5", "--output-format", "json"],
      { stdio: ["ignore", "pipe", "pipe"] }
    );
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      resolve(null);
    }, CLAUDE_TIMEOUT_MS);
    proc.stdout.on("data", (b) => (stdout += b.toString()));
    proc.stderr.on("data", (b) => (stderr += b.toString()));
    proc.on("error", () => {
      clearTimeout(timer);
      resolve(null);
    });
    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        console.warn(`[claude] rc=${code}: ${stderr.slice(0, 300)}`);
        resolve(null);
        return;
      }
      try {
        const outer = JSON.parse(stdout);
        resolve(typeof outer.result === "string" ? outer.result : null);
      } catch {
        resolve(null);
      }
    });
  });
}

let claudeAvailable: boolean | null = null;
async function detectClaude(): Promise<boolean> {
  if (claudeAvailable !== null) return claudeAvailable;
  claudeAvailable = await new Promise<boolean>((resolve) => {
    const proc = spawn("claude", ["--version"], { stdio: ["ignore", "pipe", "ignore"] });
    proc.on("error", () => resolve(false));
    proc.on("close", (code) => resolve(code === 0));
  });
  console.log(`[ai] claude CLI ${claudeAvailable ? "detected" : "not on PATH; scoring disabled"}`);
  return claudeAvailable;
}

export async function isAiEnabled(): Promise<boolean> {
  return detectClaude();
}

export async function scoreArticle(args: ScoreArgs): Promise<ArticleScore | null> {
  if (!(await detectClaude())) return null;

  const prompt = buildPrompt(args);
  await sem.acquire();
  let raw: string | null = null;
  try {
    raw = await runClaude(prompt);
  } finally {
    sem.release();
  }
  if (!raw) return null;

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(stripFences(raw));
  } catch {
    console.warn(`[ai] non-JSON output for ${args.symbol}: ${raw.slice(0, 160)}`);
    return null;
  }

  const clampInt = (v: unknown): number => {
    const n = typeof v === "number" ? v : parseInt(String(v ?? 0), 10);
    return Number.isFinite(n) ? Math.max(0, Math.min(10, n)) : 0;
  };

  let duplicateOfIndex: number | null = null;
  const rawDup = data.duplicate_of;
  if (rawDup !== null && rawDup !== undefined) {
    const n = typeof rawDup === "number" ? rawDup : parseInt(String(rawDup), 10);
    if (Number.isFinite(n) && n >= 1 && args.recentArticles && n <= args.recentArticles.length) {
      duplicateOfIndex = n;
    }
  }

  return {
    relevance: clampInt(data.relevance),
    sentiment: String(data.sentiment ?? "neutral").toLowerCase(),
    category: String(data.category ?? "other").toLowerCase(),
    thesisImpact: String(data.thesis_impact ?? "").slice(0, 500),
    novelty: clampInt(data.novelty),
    duplicateOfIndex,
  };
}
