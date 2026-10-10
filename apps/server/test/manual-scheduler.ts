import type { TickScheduler } from "../src/simulation/runtime.js";

type Scheduled = {
  run: () => void | Promise<void>;
  cancelled: boolean;
};

export class ManualScheduler implements TickScheduler {
  private readonly queue: Scheduled[] = [];

  schedule(_delayMs: number, run: () => void | Promise<void>) {
    const item = { run, cancelled: false };
    this.queue.push(item);
    return {
      cancel() {
        item.cancelled = true;
      },
    };
  }

  pending() {
    return this.queue.filter((item) => !item.cancelled).length;
  }

  async flushNext() {
    while (this.queue.length > 0) {
      const item = this.queue.shift();
      if (!item || item.cancelled) {
        continue;
      }
      await item.run();
      return;
    }
  }
}
