type Options = { limit: number; windowMs: number; maxKeys: number };
type Entry = { count: number; resetAt: number };

export class LoginRateLimiter {
  private readonly entries = new Map<string, Entry>();
  constructor(private readonly options: Options) {}

  get size(): number { return this.entries.size; }

  consume(key: string, now = Date.now()): { allowed: boolean; retryAfterSeconds: number } {
    this.prune(now);
    let entry = this.entries.get(key);
    if (!entry) {
      if (this.entries.size >= this.options.maxKeys) this.entries.delete(this.entries.keys().next().value as string);
      entry = { count: 0, resetAt: now + this.options.windowMs };
      this.entries.set(key, entry);
    }
    if (entry.count >= this.options.limit) {
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) };
    }
    entry.count += 1;
    return { allowed: true, retryAfterSeconds: 0 };
  }

  reset(key: string): void { this.entries.delete(key); }

  private prune(now: number): void {
    for (const [key, entry] of this.entries) if (entry.resetAt <= now) this.entries.delete(key);
  }
}
