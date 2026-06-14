import { useEffect, useRef } from "react";

type Handler = (data: unknown) => void;

/** Subscribe to named SSE events on /api/events. Reconnects on drop. */
export function useSSE(handlers: Record<string, Handler>): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    let es: EventSource | null = null;
    let cancelled = false;

    function connect() {
      if (cancelled) return;
      es = new EventSource("/api/events");
      const types = Object.keys(handlersRef.current);
      for (const t of types) {
        es.addEventListener(t, (ev: MessageEvent) => {
          try {
            handlersRef.current[t]?.(JSON.parse(ev.data));
          } catch {
            handlersRef.current[t]?.(ev.data);
          }
        });
      }
      es.addEventListener("error", () => {
        es?.close();
        es = null;
        if (!cancelled) setTimeout(connect, 2500);
      });
    }
    connect();
    return () => {
      cancelled = true;
      es?.close();
    };
  }, []);
}
