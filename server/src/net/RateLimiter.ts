// Per-key token bucket. Used to throttle room creation, WS upgrades,
// and inbound WS messages. Single-machine in-memory; resets on restart.

type Bucket = { tokens: number; last: number };

export class TokenBucket {
  private buckets = new Map<string, Bucket>();

  constructor(
    private readonly capacity: number,
    private readonly refillPerSec: number,
  ) {}

  // Returns true if the action is allowed (and consumes one token), false if
  // the bucket is empty.
  take(key: string, now: number = Date.now()): boolean {
    const b = this.buckets.get(key);
    if (!b) {
      this.buckets.set(key, { tokens: this.capacity - 1, last: now });
      return true;
    }
    const elapsedSec = Math.max(0, (now - b.last) / 1000);
    b.tokens = Math.min(this.capacity, b.tokens + elapsedSec * this.refillPerSec);
    b.last = now;
    if (b.tokens < 1) return false;
    b.tokens -= 1;
    return true;
  }

  // Drop entries that have been idle long enough that they would be at full
  // capacity anyway. Call periodically to bound memory.
  prune(now: number = Date.now()): void {
    const idleMs = (this.capacity / this.refillPerSec) * 1000;
    for (const [key, b] of this.buckets) {
      if (now - b.last > idleMs) this.buckets.delete(key);
    }
  }

  size(): number {
    return this.buckets.size;
  }
}
