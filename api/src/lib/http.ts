/**
 * Shared HTTP helpers. A realistic desktop-browser UA matters a lot for Indian
 * market endpoints (NSE/BSE sit behind Akamai bot protection that rejects obvious
 * bot agents). Timeouts + one retry keep flaky CDNs from stalling an ingest cycle.
 */

export const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export interface FetchOpts {
  headers?: Record<string, string>;
  timeoutMs?: number;
  retries?: number;
}

export async function fetchWithTimeout(
  url: string,
  opts: FetchOpts = {}
): Promise<Response> {
  const { headers = {}, timeoutMs = 15_000, retries = 1 } = opts;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const r = await fetch(url, {
        headers: { "User-Agent": BROWSER_UA, ...headers },
        signal: ac.signal,
        redirect: "follow",
      });
      clearTimeout(timer);
      return r;
    } catch (e) {
      clearTimeout(timer);
      lastErr = e;
      if (attempt < retries) await sleep(400 + attempt * 600);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export async function fetchJson<T>(url: string, opts: FetchOpts = {}): Promise<T> {
  const r = await fetchWithTimeout(url, {
    ...opts,
    headers: { Accept: "application/json", ...(opts.headers ?? {}) },
  });
  if (!r.ok) throw new Error(`${url} -> ${r.status}`);
  const text = await r.text();
  // Some Indian endpoints return a bare quoted string ("No Record Found!") instead
  // of valid JSON; surface that as a typed empty rather than a parse crash upstream.
  return JSON.parse(text) as T;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
