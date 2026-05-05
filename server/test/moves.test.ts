import { describe, expect, it } from 'vitest';
import { hasLegalMove, inCheck, legalMoves, pseudoLegalMoves } from '../src/engine/moves.js';
import { startingBoardState } from '../src/engine/board.js';
import { P, S, makeBoard } from './helpers.js';

describe('move generation: starting position', () => {
  it('white has 20 legal moves', () => {
    const s = startingBoardState();
    expect(legalMoves(s).length).toBe(20);
  });
});

describe('pawn moves', () => {
  it('single and double push from start', () => {
    const s = makeBoard([[P('P', 'w'), S('e2')]]);
    const moves = pseudoLegalMoves(s);
    expect(moves.map((m) => m.to).sort()).toEqual([S('e3'), S('e4')].sort());
  });

  it('no double push if blocked', () => {
    const s = makeBoard([
      [P('P', 'w'), S('e2')],
      [P('P', 'b'), S('e3')],
    ]);
    const moves = pseudoLegalMoves(s);
    expect(moves.length).toBe(0);
  });

  it('captures diagonally', () => {
    const s = makeBoard([
      [P('P', 'w'), S('e4')],
      [P('P', 'b'), S('d5')],
      [P('P', 'b'), S('f5')],
    ]);
    const tos = pseudoLegalMoves(s).map((m) => m.to).sort();
    expect(tos).toEqual([S('d5'), S('e5'), S('f5')].sort());
  });

  it('en passant capture', () => {
    const s = makeBoard(
      [
        [P('P', 'w'), S('e5')],
        [P('P', 'b'), S('d5')],
      ],
      { enPassant: S('d6') },
    );
    const moves = pseudoLegalMoves(s);
    const ep = moves.find((m) => m.enPassantCapture !== undefined);
    expect(ep).toBeDefined();
    expect(ep!.to).toBe(S('d6'));
    expect(ep!.enPassantCapture).toBe(S('d5'));
  });

  it('promotion is flagged', () => {
    const s = makeBoard([[P('P', 'w'), S('e7')]]);
    const m = pseudoLegalMoves(s).find((m) => m.to === S('e8'));
    expect(m).toBeDefined();
    expect(m!.triggersPromotion).toBe(true);
  });
});

describe('check / mate detection', () => {
  it('inCheck detects rook check', () => {
    const s = makeBoard([
      [P('K', 'w'), S('e1')],
      [P('R', 'b'), S('e8')],
    ]);
    expect(inCheck(s, 'w')).toBe(true);
  });

  it('legal moves filter out self-check', () => {
    // White king on e1, black rook on e8, white rook pinned on e2.
    const s = makeBoard([
      [P('K', 'w'), S('e1')],
      [P('R', 'w'), S('e2')],
      [P('R', 'b'), S('e8')],
    ]);
    const moves = legalMoves(s).filter((m) => m.from === S('e2'));
    // The rook can only stay on the e-file.
    for (const m of moves) {
      expect(m.to % 8).toBe(4); // file e
    }
  });

  it('checkmate: back-rank has no escape', () => {
    const s = makeBoard(
      [
        [P('K', 'w'), S('h1')],
        [P('P', 'w'), S('g2')],
        [P('P', 'w'), S('h2')],
        [P('P', 'w'), S('f2')],
        [P('R', 'b'), S('a1')],
      ],
      { turn: 'w' },
    );
    expect(inCheck(s, 'w')).toBe(true);
    expect(hasLegalMove(s)).toBe(false);
  });
});

describe('castling', () => {
  it('kingside allowed when path is clear and rights present', () => {
    const s = makeBoard(
      [
        [P('K', 'w'), S('e1')],
        [P('R', 'w'), S('h1')],
      ],
      { turn: 'w', castling: { wK: true, wQ: false, bK: false, bQ: false } },
    );
    const m = pseudoLegalMoves(s).find((m) => m.castle === 'K');
    expect(m).toBeDefined();
    expect(m!.to).toBe(S('g1'));
  });

  it('castling forbidden through check', () => {
    const s = makeBoard(
      [
        [P('K', 'w'), S('e1')],
        [P('R', 'w'), S('h1')],
        [P('R', 'b'), S('f8')], // attacks f1
      ],
      { turn: 'w', castling: { wK: true, wQ: false, bK: false, bQ: false } },
    );
    const m = pseudoLegalMoves(s).find((m) => m.castle === 'K');
    expect(m).toBeUndefined();
  });

  it('queenside allowed (b1 may be attacked, only c/d/e matter)', () => {
    const s = makeBoard(
      [
        [P('K', 'w'), S('e1')],
        [P('R', 'w'), S('a1')],
      ],
      { turn: 'w', castling: { wK: false, wQ: true, bK: false, bQ: false } },
    );
    const m = pseudoLegalMoves(s).find((m) => m.castle === 'Q');
    expect(m).toBeDefined();
    expect(m!.to).toBe(S('c1'));
  });
});
