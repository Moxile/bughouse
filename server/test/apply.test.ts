import { describe, expect, it } from 'vitest';
import { applyMove, applyDropRaw, DropError } from '../src/engine/apply.js';
import { pseudoLegalMoves } from '../src/engine/moves.js';
import { P, S, makeBoard } from './helpers.js';

describe('applyMove basics', () => {
  it('applies a simple move and switches turn', () => {
    const s = makeBoard([
      [P('P', 'w'), S('e2')],
      [P('K', 'w'), S('a1')],
      [P('K', 'b'), S('a8')],
    ], { turn: 'w' });
    const m = pseudoLegalMoves(s).find((m) => m.from === S('e2') && m.to === S('e4'))!;
    const r = applyMove(s, m);
    expect(r.state.board[S('e4')]?.type).toBe('P');
    expect(r.state.board[S('e2')]).toBe(null);
    expect(r.state.turn).toBe('b');
    expect(r.state.enPassant).toBe(S('e3'));
  });

  it('captures return the captured piece', () => {
    const s = makeBoard([
      [P('P', 'w'), S('e4')],
      [P('P', 'b'), S('d5')],
      [P('K', 'w'), S('a1')],
      [P('K', 'b'), S('a8')],
    ], { turn: 'w' });
    const m = pseudoLegalMoves(s).find((m) => m.from === S('e4') && m.to === S('d5'))!;
    const r = applyMove(s, m);
    expect(r.captured?.type).toBe('P');
    expect(r.captured?.color).toBe('b');
  });

  it('promotion does NOT switch turn and sets pendingPromotion', () => {
    const s = makeBoard([
      [P('P', 'w'), S('e7')],
      [P('K', 'w'), S('a1')],
      [P('K', 'b'), S('a8')],
    ], { turn: 'w' });
    const m = pseudoLegalMoves(s).find((m) => m.from === S('e7') && m.to === S('e8'))!;
    const r = applyMove(s, m);
    expect(r.triggeredPromotion).toBe(true);
    expect(r.state.turn).toBe('w'); // unchanged
    expect(r.state.pendingPromotion).toEqual({
      from: S('e7'),
      to: S('e8'),
      color: 'w',
      capturedAtTo: null,
    });
  });

  it('king capture sets kingCaptured', () => {
    const s = makeBoard([
      [P('Q', 'w'), S('e7')],
      [P('K', 'w'), S('a1')],
      [P('K', 'b'), S('e8')],
    ], { turn: 'w' });
    const m = pseudoLegalMoves(s).find((m) => m.from === S('e7') && m.to === S('e8'))!;
    const r = applyMove(s, m);
    expect(r.kingCaptured).toBe(true);
    expect(r.captured?.type).toBe('K');
  });

  it('en passant capture removes the pawn behind', () => {
    const s = makeBoard(
      [
        [P('P', 'w'), S('e5')],
        [P('P', 'b'), S('d5')],
        [P('K', 'w'), S('a1')],
        [P('K', 'b'), S('a8')],
      ],
      { turn: 'w', enPassant: S('d6') },
    );
    const m = pseudoLegalMoves(s).find((m) => m.from === S('e5') && m.to === S('d6'))!;
    const r = applyMove(s, m);
    expect(r.state.board[S('d5')]).toBe(null);
    expect(r.state.board[S('d6')]?.color).toBe('w');
    expect(r.captured?.type).toBe('P');
  });

  it('castling moves both king and rook', () => {
    const s = makeBoard(
      [
        [P('K', 'w'), S('e1')],
        [P('R', 'w'), S('h1')],
        [P('K', 'b'), S('a8')],
      ],
      { turn: 'w', castling: { wK: true, wQ: false, bK: false, bQ: false } },
    );
    const m = pseudoLegalMoves(s).find((m) => m.castle === 'K')!;
    const r = applyMove(s, m);
    expect(r.state.board[S('g1')]?.type).toBe('K');
    expect(r.state.board[S('f1')]?.type).toBe('R');
    expect(r.state.board[S('h1')]).toBe(null);
    expect(r.state.castling.wK).toBe(false);
  });
});

describe('applyDropRaw', () => {
  const base = () => makeBoard([
    [P('K', 'w'), S('a1')],
    [P('K', 'b'), S('a8')],
  ], { turn: 'w' });

  it('rejects pawn drop on first/last rank', () => {
    expect(() => applyDropRaw(base(), 'w', { piece: 'P', to: S('e1') }, 1))
      .toThrow(DropError);
    expect(() => applyDropRaw(base(), 'w', { piece: 'P', to: S('e8') }, 1))
      .toThrow(DropError);
  });

  it('rejects drop on occupied square', () => {
    const s = makeBoard([
      [P('K', 'w'), S('a1')],
      [P('K', 'b'), S('a8')],
      [P('P', 'b'), S('e4')],
    ], { turn: 'w' });
    expect(() => applyDropRaw(s, 'w', { piece: 'N', to: S('e4') }, 1))
      .toThrow(DropError);
  });

  it('rejects drop with no piece in hand', () => {
    expect(() => applyDropRaw(base(), 'w', { piece: 'N', to: S('e4') }, 0))
      .toThrow(DropError);
  });

  it('rejects drop that leaves dropper in self-check', () => {
    // White king on e1, black rook on e8, white drops a pawn that doesn't
    // block the check. Self-check: still in check after.
    const s = makeBoard([
      [P('K', 'w'), S('e1')],
      [P('R', 'b'), S('e8')],
      [P('K', 'b'), S('h8')],
    ], { turn: 'w' });
    expect(() => applyDropRaw(s, 'w', { piece: 'N', to: S('a4') }, 1))
      .toThrow(DropError);
  });

  it('accepts a drop that blocks check', () => {
    const s = makeBoard([
      [P('K', 'w'), S('e1')],
      [P('R', 'b'), S('e8')],
      [P('K', 'b'), S('h8')],
    ], { turn: 'w' });
    const next = applyDropRaw(s, 'w', { piece: 'N', to: S('e4') }, 1);
    expect(next.board[S('e4')]?.type).toBe('N');
    expect(next.turn).toBe('b');
  });
});
