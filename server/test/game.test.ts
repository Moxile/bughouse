import { describe, expect, it } from 'vitest';
import {
  applyGameDrop,
  applyGameMove,
  applyGamePromotion,
  diagonalHasEligiblePromotionTarget,
  MoveError,
} from '../src/engine/game.js';
import { DropError } from '../src/engine/apply.js';
import { pseudoLegalMoves } from '../src/engine/moves.js';
import { Seat, partnerOf, diagonalOf } from '@bughouse/shared';
import { P, S, emptyGame, makeBoard, startingGame } from './helpers.js';

describe('captures-to-partner', () => {
  it('captured piece goes to partner hand (not own hand)', () => {
    const gs = emptyGame();
    gs.boards[0] = makeBoard(
      [
        [P('K', 'w'), S('a1')],
        [P('K', 'b'), S('a8')],
        [P('Q', 'w'), S('e2')],
        [P('N', 'b'), S('e5')],
      ],
      { turn: 'w' },
    );
    // Seat 0 (B0,W) captures a black knight. Partner = seat 2.
    const m = pseudoLegalMoves(gs.boards[0]).find((m) => m.from === S('e2') && m.to === S('e5'))!;
    applyGameMove(gs, 0 as Seat, m);
    expect(gs.hands[2].N).toBe(1);
    expect(gs.hands[0].N).toBe(0);
  });

  it('captured wasPromoted piece returns as a pawn to partner hand', () => {
    const gs = emptyGame();
    gs.boards[0] = makeBoard(
      [
        [P('K', 'w'), S('a1')],
        [P('K', 'b'), S('a8')],
        [P('Q', 'b', /*wasPromoted*/ true), S('e5')],
        [P('Q', 'w'), S('e2')],
      ],
      { turn: 'w' },
    );
    const m = pseudoLegalMoves(gs.boards[0]).find((m) => m.from === S('e2') && m.to === S('e5'))!;
    applyGameMove(gs, 0 as Seat, m);
    expect(gs.hands[2].P).toBe(1);
    expect(gs.hands[2].Q).toBe(0);
  });
});

describe('king capture ends game', () => {
  it('move that captures king ends game with team result', () => {
    const gs = emptyGame();
    gs.boards[0] = makeBoard(
      [
        [P('K', 'w'), S('a1')],
        [P('K', 'b'), S('e8')], // exposed somehow
        [P('Q', 'w'), S('e7')],
      ],
      { turn: 'w' },
    );
    const m = pseudoLegalMoves(gs.boards[0]).find((m) => m.from === S('e7') && m.to === S('e8'))!;
    applyGameMove(gs, 0 as Seat, m);
    expect(gs.status).toBe('ended');
    expect(gs.result?.reason).toBe('king-capture');
    // Seat 0 (team 0) captured seat 1's king (team 1).
    expect(gs.result?.winningTeam).toBe(0);
    expect(gs.result?.losingSeat).toBe(1);
  });
});

describe('partner-aware mate-by-drop rule', () => {
  it('rejects a drop that delivers checkmate to opponent (no escape, no hand)', () => {
    const gs = emptyGame();
    // Black king cornered on h8; white drops a queen on g7 -> mate.
    // Black has no pieces in hand. Black has no escape moves.
    gs.boards[0] = makeBoard(
      [
        [P('K', 'w'), S('a1')],
        [P('K', 'b'), S('h8')],
        [P('Q', 'w'), S('g3')], // supports g7 -> the dropped queen would mate
      ],
      { turn: 'w' },
    );
    gs.hands[0].Q = 1;
    expect(() =>
      applyGameDrop(gs, 0 as Seat, { piece: 'Q', to: S('g7') }),
    ).toThrow(DropError);
  });

  it('allows a drop that delivers check but not mate', () => {
    const gs = emptyGame();
    gs.boards[0] = makeBoard(
      [
        [P('K', 'w'), S('a1')],
        [P('K', 'b'), S('e8')],
      ],
      { turn: 'w' },
    );
    gs.hands[0].R = 1;
    // Drop white rook on e2 — checks but black has many escapes.
    expect(() =>
      applyGameDrop(gs, 0 as Seat, { piece: 'R', to: S('e2') }),
    ).not.toThrow();
  });

  it('drop is allowed if opponent has a hand piece that can interpose', () => {
    const gs = emptyGame();
    // Geometry: white drops queen on a1, giving check along the a-file to
    // the black king on a8. The white rook on b5 covers b7 and b8, so the
    // king has no escape squares. HOWEVER black has a bishop in hand that
    // can interpose on any square between a1 and a8 (e.g. a5) — so it is
    // not mate and the drop must be allowed.
    gs.boards[0] = makeBoard(
      [
        [P('K', 'w'), S('h1')],
        [P('K', 'b'), S('a8')],
        [P('R', 'w'), S('b5')], // covers b7 and b8 -> king has no escape moves
      ],
      { turn: 'w' },
    );
    gs.hands[0].Q = 1;   // white drops queen on a1
    gs.hands[1].B = 1;   // black (seat 1) has a bishop to interpose
    expect(() =>
      applyGameDrop(gs, 0 as Seat, { piece: 'Q', to: S('a1') }),
    ).not.toThrow();
  });
});

describe('promotion swap', () => {
  function promotionSetup() {
    const gs = emptyGame();
    // Board 0: white pawn on e7, black king on a8, white king on a1.
    gs.boards[0] = makeBoard(
      [
        [P('K', 'w'), S('a1')],
        [P('K', 'b'), S('a8')],
        [P('P', 'w'), S('e7')],
      ],
      { turn: 'w' },
    );
    // Board 1: white king (diagonal opp of seat 0 = seat 3 = B1 white)
    // has a queen at d3, knight at f3, plus pawns. Seat 2 (B1 black) has
    // some pieces too.
    gs.boards[1] = makeBoard(
      [
        [P('K', 'w'), S('a1')],
        [P('K', 'b'), S('a8')],
        [P('Q', 'w'), S('d3')],
        [P('N', 'w'), S('f3')],
        [P('B', 'b'), S('c6')],
      ],
      { turn: 'w' },
    );
    return gs;
  }

  it('triggers promotion (no turn switch) and pendingPromotion is set', () => {
    const gs = promotionSetup();
    const m = pseudoLegalMoves(gs.boards[0]).find((m) => m.from === S('e7') && m.to === S('e8'))!;
    const out = applyGameMove(gs, 0 as Seat, m);
    expect(out.triggeredPromotion).toBe(true);
    expect(gs.boards[0].pendingPromotion).not.toBe(null);
    expect(gs.boards[0].turn).toBe('w'); // unchanged
  });

  it('completes promotion: takes piece from diagonal, places on promoting board, gives pawn to diagonal hand', () => {
    const gs = promotionSetup();
    const m = pseudoLegalMoves(gs.boards[0]).find((m) => m.from === S('e7') && m.to === S('e8'))!;
    applyGameMove(gs, 0 as Seat, m);
    // Seat 0 picks white queen on d3 (board 1).
    applyGamePromotion(gs, 0 as Seat, S('d3'));

    // e8 now holds a queen (white) marked wasPromoted.
    const placed = gs.boards[0].board[S('e8')]!;
    expect(placed.type).toBe('Q');
    expect(placed.color).toBe('w');
    expect(placed.wasPromoted).toBe(true);

    // d3 on board 1 is now empty.
    expect(gs.boards[1].board[S('d3')]).toBe(null);

    // Diagonal of seat 0 = seat 3. Seat 3 gets a pawn in hand.
    expect(gs.hands[3].P).toBe(1);

    // Promoting board's turn flipped to black.
    expect(gs.boards[0].turn).toBe('b');
    expect(gs.boards[0].pendingPromotion).toBe(null);
  });

  it('rejects promotion target = king or pawn', () => {
    const gs = promotionSetup();
    const m = pseudoLegalMoves(gs.boards[0]).find((m) => m.from === S('e7') && m.to === S('e8'))!;
    applyGameMove(gs, 0 as Seat, m);
    // Try to take the diagonal opponent's king (a1 on board 1, white king).
    // Seat 0's diagonal is seat 3 (B1, white), so picking white king -> reject.
    expect(() => applyGamePromotion(gs, 0 as Seat, S('a1'))).toThrow();
  });

  it('rejects promotion target = your partner\'s piece', () => {
    const gs = promotionSetup();
    const m = pseudoLegalMoves(gs.boards[0]).find((m) => m.from === S('e7') && m.to === S('e8'))!;
    applyGameMove(gs, 0 as Seat, m);
    // Partner of seat 0 is seat 2 (B1, black). Their bishop sits on c6.
    expect(() => applyGamePromotion(gs, 0 as Seat, S('c6'))).toThrow();
  });

  it('refuses pawn-to-last-rank move when no eligible target on diagonal', () => {
    const gs = emptyGame();
    gs.boards[0] = makeBoard(
      [
        [P('K', 'w'), S('a1')],
        [P('K', 'b'), S('a8')],
        [P('P', 'w'), S('e7')],
      ],
      { turn: 'w' },
    );
    // Diagonal board: white only has a king and a pawn (no eligible piece).
    gs.boards[1] = makeBoard(
      [
        [P('K', 'w'), S('h1')],
        [P('K', 'b'), S('a8')],
        [P('P', 'w'), S('h2')],
      ],
      { turn: 'w' },
    );
    expect(diagonalHasEligiblePromotionTarget(gs, 0 as Seat)).toBe(false);
    const m = pseudoLegalMoves(gs.boards[0]).find((m) => m.from === S('e7') && m.to === S('e8'))!;
    expect(() => applyGameMove(gs, 0 as Seat, m)).toThrow(MoveError);
  });

  it('captured promoted piece (later) returns a pawn to partner', () => {
    const gs = promotionSetup();
    // Run the promotion.
    const promoMove = pseudoLegalMoves(gs.boards[0]).find((m) => m.from === S('e7') && m.to === S('e8'))!;
    applyGameMove(gs, 0 as Seat, promoMove);
    applyGamePromotion(gs, 0 as Seat, S('d3'));

    // Black to move on board 0. Black has no piece to capture the promoted
    // queen — synthesize one by placing a black rook on e1 in test.
    gs.boards[0].board[S('e1')] = P('R', 'b');
    // Move the rook to e8 capturing the wasPromoted queen.
    const cap = pseudoLegalMoves(gs.boards[0]).find((m) => m.from === S('e1') && m.to === S('e8'))!;
    applyGameMove(gs, 1 as Seat, cap);
    // Partner of seat 1 is seat 3. Should receive a PAWN (not a queen).
    expect(gs.hands[3].P).toBe(2); // 1 from earlier promotion + 1 from this capture
    expect(gs.hands[3].Q).toBe(0);
  });
});

describe('seating helpers', () => {
  it('partner mapping', () => {
    expect(partnerOf(0 as Seat)).toBe(2);
    expect(partnerOf(2 as Seat)).toBe(0);
    expect(partnerOf(1 as Seat)).toBe(3);
    expect(partnerOf(3 as Seat)).toBe(1);
  });

  it('diagonal mapping (same color, other board)', () => {
    expect(diagonalOf(0 as Seat)).toBe(3); // both white
    expect(diagonalOf(3 as Seat)).toBe(0);
    expect(diagonalOf(1 as Seat)).toBe(2); // both black
    expect(diagonalOf(2 as Seat)).toBe(1);
  });
});

describe('starting position smoke test', () => {
  it('creates a starting game with full hands empty', () => {
    const gs = startingGame();
    for (const seat of [0, 1, 2, 3] as Seat[]) {
      const total = Object.values(gs.hands[seat]).reduce((a, b) => a + b, 0);
      expect(total).toBe(0);
    }
    expect(gs.boards[0].turn).toBe('w');
    expect(gs.boards[1].turn).toBe('w');
  });
});
