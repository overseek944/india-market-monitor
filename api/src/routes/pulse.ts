import { Hono } from "hono";
import {
  getSnapshot,
  refreshPulse,
  HEADLINE_INDICES,
  SECTORAL_INDICES,
  type FiiDiiRow,
  type IndexQuote,
} from "../market/pulse.js";

export const pulseRoute = new Hono();

pulseRoute.get("/", async (c) => {
  const idx = await getSnapshot<IndexQuote[]>("indices");
  const fii = await getSnapshot<FiiDiiRow[]>("fii_dii");

  const all = idx?.data ?? [];
  const byName = new Map(all.map((q) => [q.name.toUpperCase(), q]));
  const pick = (names: string[]) =>
    names.map((n) => byName.get(n.toUpperCase())).filter((x): x is IndexQuote => !!x);

  return c.json({
    headline: pick(HEADLINE_INDICES),
    sectoral: pick(SECTORAL_INDICES),
    all,
    indicesAt: idx?.capturedAt ?? null,
    fiiDii: fii?.data ?? [],
    fiiDiiAt: fii?.capturedAt ?? null,
  });
});

pulseRoute.post("/refresh", async (c) => {
  await refreshPulse();
  return c.json({ ok: true });
});

export default pulseRoute;
