/**
 * Sémaphore en mémoire (singleton de module) pour limiter la concurrence
 * des appels sortants vers une API externe. Utilisé par fetchWithRetry
 * quand on passe { bucket: "discord" }.
 *
 * - maxConcurrency : nombre max d'opérations en cours
 * - minSpacingMs   : espacement minimal entre deux DÉPARTS
 */

interface SemaphoreOptions {
  maxConcurrency: number;
  minSpacingMs: number;
}

class Semaphore {
  private readonly opts: SemaphoreOptions;
  private active = 0;
  private lastStart = 0;
  private readonly queue: Array<() => void> = [];

  constructor(opts: SemaphoreOptions) {
    this.opts = opts;
  }

  private async acquire(): Promise<void> {
    if (this.active >= this.opts.maxConcurrency) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }
    this.active++;
    const elapsed = Date.now() - this.lastStart;
    const wait = this.opts.minSpacingMs - elapsed;
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this.lastStart = Date.now();
  }

  private release(): void {
    this.active = Math.max(0, this.active - 1);
    const next = this.queue.shift();
    if (next) next();
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
}

/** Limiteur global pour tous les appels sortants vers l'API Discord. */
export const discordLimiter = new Semaphore({
  maxConcurrency: 5,
  minSpacingMs: 50,
});
