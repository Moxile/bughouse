import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LobbyManager } from '../src/game/LobbyManager.js';
import { ClockManager } from '../src/game/ClockManager.js';
import { TokenBucket } from '../src/net/RateLimiter.js';
import { startingGame } from './helpers.js';

describe('LobbyManager.handleDisconnect', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('clears pending timer on second disconnect (no spurious forfeit)', () => {
    const lm = new LobbyManager();
    const room = lm.createRoom();
    lm.claimSeat(room, 0, 'A', 'pid-A', null);

    let timeoutsFired = 0;
    const onTimeout = () => { timeoutsFired += 1; };

    lm.handleDisconnect(room, 0, onTimeout);
    // Reconnect cancels the current timer.
    lm.handleReconnect(room, 0);
    // Disconnect again — the previous timer was already cleared on
    // reconnect, but a future variant of this code (or a missed reconnect)
    // could leak. Re-disconnect and assert no doubling-up either way.
    lm.handleDisconnect(room, 0, onTimeout);
    lm.handleDisconnect(room, 0, onTimeout);

    // 30s elapses — only the most recent timer should fire, not the prior.
    vi.advanceTimersByTime(30_000);
    expect(timeoutsFired).toBe(1);
  });
});

describe('ClockManager.scheduleFlagTimer', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('flags immediately on a non-finite clock instead of scheduling NaN', () => {
    const gs = startingGame();
    gs.clocks[0] = NaN;

    const flagged: number[] = [];
    const cm = new ClockManager();
    cm.start(gs, 0, (seat) => flagged.push(seat));

    // start() schedules timers for both boards' active seats. Seat 0 has
    // NaN clock and should flag synchronously without a real timer.
    expect(flagged).toContain(0);
    cm.stopAll();
  });
});

describe('TokenBucket', () => {
  it('allows burst up to capacity, then throttles', () => {
    const tb = new TokenBucket(3, 1);
    expect(tb.take('ip', 0)).toBe(true);
    expect(tb.take('ip', 0)).toBe(true);
    expect(tb.take('ip', 0)).toBe(true);
    expect(tb.take('ip', 0)).toBe(false);
  });

  it('refills over time at the configured rate', () => {
    const tb = new TokenBucket(2, 1);
    tb.take('ip', 0);
    tb.take('ip', 0);
    expect(tb.take('ip', 0)).toBe(false);
    // 1 second later → 1 token refilled.
    expect(tb.take('ip', 1000)).toBe(true);
    expect(tb.take('ip', 1000)).toBe(false);
  });

  it('keys are independent', () => {
    const tb = new TokenBucket(1, 1);
    expect(tb.take('a', 0)).toBe(true);
    expect(tb.take('b', 0)).toBe(true);
    expect(tb.take('a', 0)).toBe(false);
    expect(tb.take('b', 0)).toBe(false);
  });

  it('prune drops idle entries', () => {
    const tb = new TokenBucket(2, 1);
    tb.take('ip', 0);
    expect(tb.size()).toBe(1);
    // capacity / refillPerSec * 1000 = 2000ms idle threshold.
    tb.prune(10_000);
    expect(tb.size()).toBe(0);
  });
});
