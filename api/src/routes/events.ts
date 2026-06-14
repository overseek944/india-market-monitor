import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { bus } from "../lib/event-bus.js";

export const eventsRoute = new Hono();

eventsRoute.get("/", (c) =>
  streamSSE(c, async (stream) => {
    let open = true;
    const queue: Array<{ event: string; data: string }> = [];
    const unsub = bus.subscribe(({ type, data }) => {
      queue.push({ event: type, data: JSON.stringify(data) });
    });
    stream.onAbort(() => {
      open = false;
      unsub();
    });

    await stream.writeSSE({ event: "open", data: "{}" });
    let ticks = 0;
    while (open) {
      while (queue.length > 0) {
        await stream.writeSSE(queue.shift()!);
      }
      await stream.sleep(1000);
      if (++ticks >= 20) {
        ticks = 0;
        await stream.writeSSE({ event: "ping", data: "{}" });
      }
    }
    unsub();
  })
);

export default eventsRoute;
