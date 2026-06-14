import { BROWSER_UA, sleep } from "./http.js";

/**
 * NSE's public JSON APIs (https://www.nseindia.com/api/*) sit behind Akamai. A request
 * only succeeds if it carries cookies that the site hands out when you load a real page
 * first. Node's fetch has no cookie jar, so we warm one by hitting the homepage + a
 * market-data page, capture Set-Cookie, and replay it on API calls. Cookies are reused
 * across calls and lazily re-warmed when they expire or an API call 401/403s.
 */

const NSE_BASE = "https://www.nseindia.com";

const COMMON_HEADERS: Record<string, string> = {
  "User-Agent": BROWSER_UA,
  Accept: "*/*",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-origin",
};

let cookieJar = "";
let warmedAt = 0;
const COOKIE_TTL_MS = 8 * 60 * 1000;
let warming: Promise<void> | null = null;

function mergeSetCookie(res: Response): void {
  // getSetCookie() is available on Node >=18.14 undici headers
  const raw = (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
  if (raw.length === 0) return;
  const jar = new Map<string, string>();
  for (const part of cookieJar.split("; ").filter(Boolean)) {
    const eq = part.indexOf("=");
    if (eq > 0) jar.set(part.slice(0, eq), part.slice(eq + 1));
  }
  for (const c of raw) {
    const first = c.split(";")[0] ?? "";
    const eq = first.indexOf("=");
    if (eq > 0) jar.set(first.slice(0, eq).trim(), first.slice(eq + 1).trim());
  }
  cookieJar = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function warm(): Promise<void> {
  if (warming) return warming;
  warming = (async () => {
    try {
      for (const path of ["/", "/market-data/live-equity-market"]) {
        const ac = new AbortController();
        const timer = setTimeout(() => ac.abort(), 12_000);
        try {
          const res = await fetch(`${NSE_BASE}${path}`, {
            headers: {
              ...COMMON_HEADERS,
              "Sec-Fetch-Dest": "document",
              "Sec-Fetch-Mode": "navigate",
              "Sec-Fetch-Site": "none",
              "Upgrade-Insecure-Requests": "1",
              Accept:
                "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            },
            signal: ac.signal,
            redirect: "follow",
          });
          clearTimeout(timer);
          mergeSetCookie(res);
          await res.arrayBuffer().catch(() => undefined);
        } catch {
          clearTimeout(timer);
        }
        await sleep(120);
      }
      warmedAt = Date.now();
    } finally {
      warming = null;
    }
  })();
  return warming;
}

async function ensureWarm(force = false): Promise<void> {
  if (force || !cookieJar || Date.now() - warmedAt > COOKIE_TTL_MS) {
    await warm();
  }
}

/**
 * Fetch an NSE API path (e.g. "/api/corporate-announcements?...") as JSON, warming
 * and retrying once with a forced re-warm on auth failure. Returns null on failure
 * so individual sources degrade gracefully instead of throwing the whole cycle.
 */
export async function nseApi<T>(apiPath: string, referer?: string): Promise<T | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    await ensureWarm(attempt === 1);
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 15_000);
    try {
      const res = await fetch(`${NSE_BASE}${apiPath}`, {
        headers: {
          ...COMMON_HEADERS,
          Accept: "application/json, text/plain, */*",
          Referer: referer ?? `${NSE_BASE}/`,
        },
        signal: ac.signal,
        redirect: "follow",
      });
      clearTimeout(timer);
      mergeSetCookie(res);
      if (res.status === 401 || res.status === 403) continue;
      if (!res.ok) return null;
      const text = await res.text();
      if (!text || text.trimStart().startsWith("<")) continue; // bot-block HTML page
      return JSON.parse(text) as T;
    } catch {
      clearTimeout(timer);
    }
  }
  return null;
}
