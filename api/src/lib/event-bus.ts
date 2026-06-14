type Listener = (event: { type: string; data: unknown }) => void;

class EventBus {
  private listeners = new Set<Listener>();

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(type: string, data: unknown): void {
    for (const fn of this.listeners) {
      try {
        fn({ type, data });
      } catch {
        // ignore one slow consumer
      }
    }
  }
}

export const bus = new EventBus();
