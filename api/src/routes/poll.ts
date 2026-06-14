import { Hono } from "hono";
import { ingestAll } from "../ingest.js";

export const pollRoute = new Hono();

let inFlight = false;

pollRoute.post("/", async (c) => {
  if (inFlight) return c.json({ queued: false, reason: "already running" });
  inFlight = true;
  // Fire and forget; the SSE stream reports new articles as they land.
  void ingestAll()
    .catch((e) => console.error("[poll] failed:", (e as Error).message))
    .finally(() => {
      inFlight = false;
    });
  return c.json({ queued: true });
});

export default pollRoute;
