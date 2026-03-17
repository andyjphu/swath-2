type Handler<T = unknown> = (data: T) => void;

class EventBusImpl {
  private handlers = new Map<string, Set<Handler>>();

  on<T>(event: string, handler: Handler<T>): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler as Handler);
  }

  off<T>(event: string, handler: Handler<T>): void {
    this.handlers.get(event)?.delete(handler as Handler);
  }

  emit<T>(event: string, data: T): void {
    const set = this.handlers.get(event);
    if (set) {
      for (const h of set) {
        h(data);
      }
    }
  }
}

export const EventBus = new EventBusImpl();
