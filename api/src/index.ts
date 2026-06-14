import dns from "node:dns";
// Force IPv4-first DNS. Some Indian data hosts publish IPv6 records that route to dead
// addresses; Node's Happy-Eyeballs fallback is slow enough to surface as timeouts.
dns.setDefaultResultOrder("ipv4first");

import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { ensureSchema } from "./db/client.js";
import { startScheduler } from "./scheduler.js";
import { getMaster } from "./lib/instruments-master.js";
import { instrumentsRoute } from "./routes/instruments.js";
import { instrumentDetailRoute } from "./routes/instrument-detail.js";
import { feedRoute } from "./routes/feed.js";
import { pulseRoute } from "./routes/pulse.js";
import { statsRoute } from "./routes/stats.js";
import { eventsRoute } from "./routes/events.js";
import { pollRoute } from "./routes/poll.js";
import { sourcesRoute } from "./routes/sources.js";
import { alertsRoute } from "./routes/alerts.js";
import { searchRoute } from "./routes/search.js";

const PORT = parseInt(process.env.PORT ?? "3001", 10);

ensureSchema();

const app = new Hono();

app.use("*", logger());
app.use(
  "/api/*",
  cors({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
    credentials: true,
    allowHeaders: ["Content-Type"],
  })
);

app.get("/api/health", (c) => c.json({ ok: true }));

app.route("/api/instruments", instrumentsRoute);
app.route("/api/instrument", instrumentDetailRoute); // /api/instrument/:symbol
app.route("/api/feed", feedRoute);
app.route("/api/pulse", pulseRoute);
app.route("/api/stats", statsRoute);
app.route("/api/events", eventsRoute);
app.route("/api/poll", pollRoute);
app.route("/api/sources", sourcesRoute);
app.route("/api/alerts", alertsRoute);
app.route("/api/search", searchRoute);

// Warm the instrument master at boot so the first symbol search is instant.
void getMaster().catch((e) => console.warn("[master] warm failed:", (e as Error).message));

startScheduler();

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`[api] India Market Monitor → http://127.0.0.1:${info.port}`);
});
