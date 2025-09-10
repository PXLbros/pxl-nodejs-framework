export class LifecycleManager {
  private shutdownHooks: Array<() => void | Promise<void>> = [];
  private intervals = new Set<NodeJS.Timeout>();
  private timeouts = new Set<NodeJS.Timeout>();
  private shuttingDown = false;

  onShutdown(fn: () => void | Promise<void>) {
    this.shutdownHooks.push(fn);
    return () => {
      const i = this.shutdownHooks.indexOf(fn);
      if (i >= 0) this.shutdownHooks.splice(i, 1);
    };
  }

  trackInterval(id: NodeJS.Timeout) {
    this.intervals.add(id);
    return id;
  }

  trackTimeout(id: NodeJS.Timeout) {
    this.timeouts.add(id);
    return id;
  }

  async shutdown(): Promise<{ errors: unknown[] }> {
    if (this.shuttingDown) {
      return { errors: [] };
    }
    this.shuttingDown = true;

    for (const id of this.intervals) {
      clearInterval(id);
    }
    for (const id of this.timeouts) {
      clearTimeout(id);
    }
    this.intervals.clear();
    this.timeouts.clear();

    const errors: unknown[] = [];
    for (let i = this.shutdownHooks.length - 1; i >= 0; i--) {
      const hook = this.shutdownHooks[i];
      try {
        await hook();
      } catch (e) {
        errors.push(e);
      }
    }
    return { errors };
  }
}
