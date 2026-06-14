import { ingestAll } from "./ingest.js";
import { refreshPulse } from "./market/pulse.js";

const POLL_INTERVAL_SECONDS = parseInt(process.env.POLL_INTERVAL_SECONDS ?? "300", 10);
// Market Pulse (indices + FII/DII) is cheap and time-sensitive, so it ticks faster
// than the full ingest cycle during market hours.
const PULSE_INTERVAL_SECONDS = parseInt(process.env.PULSE_INTERVAL_SECONDS ?? "90", 10);

let running = false;
let ingestTimer: ReturnType<typeof setInterval> | null = null;
let pulseTimer: ReturnType<typeof setInterval> | null = null;

export function startScheduler(): void {
  if (ingestTimer) return;
  console.log(
    `[scheduler] starting · ingest=${POLL_INTERVAL_SECONDS}s · pulse=${PULSE_INTERVAL_SECONDS}s`
  );

  const ingestTick = async () => {
    if (running) return;
    running = true;
    try {
      const r = await ingestAll();
      if (r.newArticles > 0) {
        console.log(`[scheduler] +${r.newArticles} new across ${r.instruments} instruments`);
      }
    } catch (e) {
      console.error("[scheduler] ingest tick failed:", (e as Error).message);
    } finally {
      running = false;
    }
  };

  const pulseTick = async () => {
    try {
      await refreshPulse();
    } catch (e) {
      console.error("[scheduler] pulse tick failed:", (e as Error).message);
    }
  };

  ingestTimer = setInterval(ingestTick, POLL_INTERVAL_SECONDS * 1000);
  pulseTimer = setInterval(pulseTick, PULSE_INTERVAL_SECONDS * 1000);
  void ingestTick();
}

export function stopScheduler(): void {
  if (ingestTimer) clearInterval(ingestTimer);
  if (pulseTimer) clearInterval(pulseTimer);
  ingestTimer = null;
  pulseTimer = null;
}
