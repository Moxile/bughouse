import { describe, expect, it } from 'vitest';
import { isValidSeat, validateClientMessage } from '@bughouse/shared';

describe('validateClientMessage', () => {
  it('rejects non-objects', () => {
    expect(validateClientMessage(null)).toBeNull();
    expect(validateClientMessage('hi')).toBeNull();
    expect(validateClientMessage(42)).toBeNull();
    expect(validateClientMessage(undefined)).toBeNull();
  });

  it('rejects unknown message types', () => {
    expect(validateClientMessage({ type: 'lol' })).toBeNull();
  });

  describe('claim-seat', () => {
    it('accepts seats 0..3', () => {
      for (const s of [0, 1, 2, 3]) {
        expect(validateClientMessage({ type: 'claim-seat', seat: s })).toEqual({
          type: 'claim-seat',
          seat: s,
        });
      }
    });

    it('rejects out-of-range seats', () => {
      expect(validateClientMessage({ type: 'claim-seat', seat: 999 })).toBeNull();
      expect(validateClientMessage({ type: 'claim-seat', seat: -1 })).toBeNull();
      expect(validateClientMessage({ type: 'claim-seat', seat: 1.5 })).toBeNull();
    });

    it('rejects non-numeric seats', () => {
      expect(validateClientMessage({ type: 'claim-seat', seat: '0' })).toBeNull();
      expect(validateClientMessage({ type: 'claim-seat', seat: null })).toBeNull();
      expect(validateClientMessage({ type: 'claim-seat' })).toBeNull();
    });
  });

  describe('set-time-control', () => {
    it('accepts integer minutes 1..5', () => {
      for (const m of [1, 2, 3, 4, 5]) {
        expect(validateClientMessage({ type: 'set-time-control', minutes: m })).toEqual({
          type: 'set-time-control',
          minutes: m,
        });
      }
    });

    it('rejects NaN minutes (the bypass we are guarding against)', () => {
      expect(validateClientMessage({ type: 'set-time-control', minutes: NaN })).toBeNull();
    });

    it('rejects Infinity', () => {
      expect(validateClientMessage({ type: 'set-time-control', minutes: Infinity })).toBeNull();
      expect(validateClientMessage({ type: 'set-time-control', minutes: -Infinity })).toBeNull();
    });

    it('rejects out-of-range minutes', () => {
      expect(validateClientMessage({ type: 'set-time-control', minutes: 0 })).toBeNull();
      expect(validateClientMessage({ type: 'set-time-control', minutes: 6 })).toBeNull();
    });

    it('rejects non-numeric minutes', () => {
      expect(validateClientMessage({ type: 'set-time-control', minutes: '5' })).toBeNull();
      expect(validateClientMessage({ type: 'set-time-control', minutes: null })).toBeNull();
      expect(validateClientMessage({ type: 'set-time-control', minutes: {} })).toBeNull();
    });
  });

  describe('move', () => {
    it('accepts valid squares', () => {
      expect(validateClientMessage({ type: 'move', boardId: 0, from: 12, to: 28 })).toEqual({
        type: 'move', boardId: 0, from: 12, to: 28,
      });
    });

    it('rejects out-of-range squares', () => {
      expect(validateClientMessage({ type: 'move', boardId: 0, from: 99, to: 0 })).toBeNull();
      expect(validateClientMessage({ type: 'move', boardId: 0, from: -1, to: 0 })).toBeNull();
      expect(validateClientMessage({ type: 'move', boardId: 0, from: 1.5, to: 0 })).toBeNull();
    });

    it('rejects invalid boardId', () => {
      expect(validateClientMessage({ type: 'move', boardId: 2, from: 0, to: 8 })).toBeNull();
    });
  });

  describe('drop', () => {
    it('accepts valid drop pieces', () => {
      for (const p of ['P', 'N', 'B', 'R', 'Q']) {
        expect(validateClientMessage({ type: 'drop', boardId: 0, piece: p, to: 16 })).toEqual({
          type: 'drop', boardId: 0, piece: p, to: 16,
        });
      }
    });

    it('rejects king drops', () => {
      expect(validateClientMessage({ type: 'drop', boardId: 0, piece: 'K', to: 16 })).toBeNull();
    });

    it('rejects garbage piece values', () => {
      expect(validateClientMessage({ type: 'drop', boardId: 0, piece: 'XX', to: 16 })).toBeNull();
      expect(validateClientMessage({ type: 'drop', boardId: 0, piece: 1, to: 16 })).toBeNull();
    });
  });

  describe('chat', () => {
    it('truncates and trims text', () => {
      const msg = validateClientMessage({ type: 'chat', text: '   hello   ' });
      expect(msg).toEqual({ type: 'chat', text: 'hello' });
    });

    it('rejects empty/whitespace-only chat', () => {
      expect(validateClientMessage({ type: 'chat', text: '' })).toBeNull();
      expect(validateClientMessage({ type: 'chat', text: '   ' })).toBeNull();
    });

    it('strips zero-width and bidi-override marks', () => {
      // U+200B zero-width space, U+202E right-to-left override
      const msg = validateClientMessage({ type: 'chat', text: 'a​b‮c' });
      expect(msg).toEqual({ type: 'chat', text: 'abc' });
    });

    it('rejects non-string text', () => {
      expect(validateClientMessage({ type: 'chat', text: 5 })).toBeNull();
      expect(validateClientMessage({ type: 'chat' })).toBeNull();
    });
  });

  describe('join name sanitisation', () => {
    it('trims and caps to 20 code points', () => {
      const msg = validateClientMessage({ type: 'join', code: 'ABCDEF', name: 'a'.repeat(50) });
      expect(msg && msg.type === 'join' && msg.name).toBe('a'.repeat(20));
    });

    it('falls back to "Player" when sanitised name is empty', () => {
      const msg = validateClientMessage({ type: 'join', code: 'ABCDEF', name: '​​' });
      expect(msg && msg.type === 'join' && msg.name).toBe('Player');
    });

    it('rejects invalid playerId types', () => {
      expect(
        validateClientMessage({ type: 'join', code: 'ABCDEF', name: 'x', playerId: 12 }),
      ).toBeNull();
    });
  });
});

describe('isValidSeat', () => {
  it('accepts 0,1,2,3 only', () => {
    expect(isValidSeat(0)).toBe(true);
    expect(isValidSeat(3)).toBe(true);
    expect(isValidSeat(4)).toBe(false);
    expect(isValidSeat(-1)).toBe(false);
    expect(isValidSeat('0')).toBe(false);
    expect(isValidSeat(null)).toBe(false);
  });
});
