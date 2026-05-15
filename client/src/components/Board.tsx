import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Board as BoardType,
  Color,
  DropPieceType,
  Square,
  fileOf,
  rankOf,
  sq,
} from '@bughouse/shared';
import { ChessPiece, PieceType } from './ChessPiece.js';
import { ColorScheme, DEFAULT_SCHEME } from '../themes.js';
import { PieceSet, DEFAULT_PIECE_SET } from '../pieceSets.js';

export type PremoveState =
  | { type: 'move'; from: Square; to: Square }
  | { type: 'drop'; piece: DropPieceType; to: Square };

export type BoardInteraction =
  | { mode: 'move'; onMove: (from: Square, to: Square) => void; getTargets: (from: Square) => Set<Square> }
  | {
      mode: 'drop';
      piece: DropPieceType;
      dropTargets: Set<Square>;
      onDrop: (to: Square) => void;
      onCancel?: () => void;
      getMoveTargets?: (from: Square) => Set<Square>;
      onMove?: (from: Square, to: Square) => void;
    }
  | { mode: 'promotion-pick'; onPick: (sq: Square) => void; onCancel?: () => void; validSquares?: Set<Square> };

// ─── Stable piece identity ────────────────────────────────────────────────────

type StablePiece = {
  id: string;
  color: Color;
  type: string;
  square: Square;
  exiting: boolean;   // captured — fade out
  noTransition: boolean;
};

let _nextPieceId = 0;
function makePieceId(): string { return `p${++_nextPieceId}`; }

function initialPieces(board: BoardType): StablePiece[] {
  const result: StablePiece[] = [];
  for (let s = 0; s < 64; s++) {
    const p = board[s];
    if (p) result.push({ id: makePieceId(), color: p.color, type: p.type, square: s, exiting: false, noTransition: true });
  }
  return result;
}

function reconcilePieces(
  prev: StablePiece[],
  newBoard: BoardType,
  lastMove: { from: Square; to: Square } | null | undefined,
  suppressDestSq: Square | null, // skip CSS transition for this square (our own drag)
): StablePiece[] {
  const prevBySquare = new Map<Square, StablePiece>();
  for (const p of prev) {
    if (!p.exiting) prevBySquare.set(p.square, p);
  }

  const result: StablePiece[] = [];
  const usedPrevSquares = new Set<Square>();
  const assignedNewSquares = new Set<Square>();

  // Pass 1: unchanged pieces at same square
  for (let s = 0; s < 64; s++) {
    const np = newBoard[s];
    if (!np) continue;
    const pp = prevBySquare.get(s);
    if (pp && pp.color === np.color && pp.type === np.type) {
      result.push({ ...pp, exiting: false, noTransition: false });
      usedPrevSquares.add(s);
      assignedNewSquares.add(s);
    }
  }

  // Pass 2: use lastMove hint (handles normal moves, promotions)
  if (lastMove && !assignedNewSquares.has(lastMove.to) && !usedPrevSquares.has(lastMove.from)) {
    const np = newBoard[lastMove.to];
    const pp = prevBySquare.get(lastMove.from);
    if (np && pp && pp.color === np.color) {
      result.push({
        id: pp.id,
        color: np.color,
        type: np.type,
        square: lastMove.to,
        exiting: false,
        noTransition: suppressDestSq === lastMove.to,
      });
      usedPrevSquares.add(lastMove.from);
      assignedNewSquares.add(lastMove.to);
    }
  }

  // Pass 3: match remaining new squares to remaining prev pieces (handles castling rook, etc.)
  const availablePrev: StablePiece[] = [];
  for (const [, p] of prevBySquare) {
    if (!usedPrevSquares.has(p.square)) availablePrev.push(p);
  }

  for (let s = 0; s < 64; s++) {
    const np = newBoard[s];
    if (!np || assignedNewSquares.has(s)) continue;
    const matchIdx = availablePrev.findIndex(p => p.color === np.color && p.type === np.type);
    if (matchIdx >= 0) {
      const match = availablePrev.splice(matchIdx, 1)[0]!;
      result.push({ id: match.id, color: np.color, type: np.type, square: s, exiting: false, noTransition: suppressDestSq === s });
      usedPrevSquares.add(match.square);
      assignedNewSquares.add(s);
    } else {
      // New piece (drop from hand, initial render)
      result.push({ id: makePieceId(), color: np.color, type: np.type, square: s, exiting: false, noTransition: true });
      assignedNewSquares.add(s);
    }
  }

  // Pass 4: unmatched prev pieces = captured (fade out)
  for (const p of availablePrev) {
    result.push({ ...p, exiting: true, noTransition: false });
  }

  return result;
}

// ─── Snap animation ───────────────────────────────────────────────────────────

type SnapAnim = {
  piece: { color: Color; type: string };
  fromSquare: Square;  // hide real piece here while animating
  toSquare: Square;    // animate to here (equals fromSquare for snap-back)
  cursorX: number;
  cursorY: number;
};

// ─── Component ────────────────────────────────────────────────────────────────

type Props = {
  board: BoardType;
  perspective: Color;
  interaction: BoardInteraction | null;
  pendingPromoSquare?: Square | null;
  promotionPickColor?: Color;
  label?: string;
  premove?: PremoveState | null;
  onCancelPremove?: () => void;
  cellSize?: number;
  colorScheme?: ColorScheme;
  pieceSet?: PieceSet;
  lastMove?: { from: Square; to: Square } | null;
  onHotkeyDrop?: (piece: DropPieceType, to: Square) => void;
};

const DRAG_PX = 5;

export function Board({
  board,
  perspective,
  interaction,
  pendingPromoSquare,
  promotionPickColor,
  label,
  premove,
  onCancelPremove,
  cellSize = 65,
  colorScheme = DEFAULT_SCHEME,
  pieceSet = DEFAULT_PIECE_SET,
  lastMove,
  onHotkeyDrop,
}: Props) {
  const cs = colorScheme;
  const [selected, setSelected] = useState<Square | null>(null);
  const [hoverSquare, setHoverSquare] = useState<Square | null>(null);
  const [drag, setDrag] = useState<{
    src: Square;
    piece: { color: Color; type: string };
    x: number;
    y: number;
    hover: Square | null;
  } | null>(null);
  const [snapAnim, setSnapAnim] = useState<SnapAnim | null>(null);
  const [stablePieces, setStablePieces] = useState<StablePiece[]>(() => initialPieces(board));

  const gridRef = useRef<HTMLDivElement>(null);
  const snapRef = useRef<HTMLDivElement>(null);
  // Dest square of our own drag move — suppresses redundant CSS transition when
  // the board state update arrives after we've already shown the snap animation.
  const lastOwnMoveDest = useRef<Square | null>(null);

  const pieceSize = Math.round(cellSize * 0.82);
  const coordSize = Math.max(8, Math.round(cellSize * 0.18));

  // ── Reconcile pieces on board change ───────────────────────────────────────
  const isFirstBoardRender = useRef(true);
  useEffect(() => {
    if (isFirstBoardRender.current) { isFirstBoardRender.current = false; return; }
    const suppress = lastOwnMoveDest.current;
    lastOwnMoveDest.current = null;
    setStablePieces(prev => reconcilePieces(prev, board, lastMove, suppress));
  }, [board]); // eslint-disable-line react-hooks/exhaustive-deps

  // Remove exiting (captured) pieces after fade completes
  useEffect(() => {
    if (!stablePieces.some(p => p.exiting)) return;
    const t = setTimeout(() => setStablePieces(prev => prev.filter(p => !p.exiting)), 220);
    return () => clearTimeout(t);
  }, [stablePieces]);

  // Suppress transition when perspective flips (board rotation in review mode)
  const prevPerspRef = useRef(perspective);
  useEffect(() => {
    if (prevPerspRef.current === perspective) return;
    prevPerspRef.current = perspective;
    setStablePieces(prev => prev.map(p => ({ ...p, noTransition: true })));
  }, [perspective]);

  // ── Snap animation: mount at cursor position, then transition to dest ───────
  useLayoutEffect(() => {
    if (!snapAnim || !snapRef.current) return;
    const el = snapRef.current;
    const dest = clientFromSq(snapAnim.toSquare);
    if (!dest) return;
    void el.getBoundingClientRect(); // force reflow so browser paints the cursor-start position
    el.style.transition = 'transform 130ms cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    el.style.transform = `translate3d(${dest.x - pieceSize / 2}px, ${dest.y - pieceSize / 2}px, 0)`;
  }, [snapAnim]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Global grabbing cursor ──────────────────────────────────────────────────
  const isDragging = drag !== null;
  useEffect(() => {
    if (!isDragging) return;
    document.body.style.cursor = 'grabbing';
    return () => { document.body.style.cursor = ''; };
  }, [isDragging]);

  // ── Cancel promotion on outside click ──────────────────────────────────────
  useEffect(() => {
    if (interaction?.mode !== 'promotion-pick') return;
    const { onCancel } = interaction;
    const handler = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const g = gridRef.current;
      if (!g) return;
      const rect = g.getBoundingClientRect();
      const inBoard = e.clientX >= rect.left && e.clientX <= rect.right
        && e.clientY >= rect.top && e.clientY <= rect.bottom;
      if (!inBoard) onCancel?.();
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [interaction]);

  // ── Hotkey drops ────────────────────────────────────────────────────────────
  useEffect(() => {
    const pieceMap: Record<string, DropPieceType> = { '1': 'P', '2': 'N', '3': 'B', '4': 'R', '5': 'Q' };
    const onKeyDown = (e: KeyboardEvent) => {
      if (!hoverSquare) return;
      const piece = pieceMap[e.key];
      if (!piece) return;
      if (onHotkeyDrop) {
        e.preventDefault();
        onHotkeyDrop(piece, hoverSquare);
      } else if (interaction?.mode === 'drop' && interaction.dropTargets.has(hoverSquare)) {
        e.preventDefault();
        interaction.onDrop(hoverSquare);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [hoverSquare, interaction, onHotkeyDrop]);

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const sqFromClient = useCallback((cx: number, cy: number): Square | null => {
    const g = gridRef.current;
    if (!g) return null;
    const rect = g.getBoundingClientRect();
    const fi = (cx - rect.left) / cellSize;
    const ri = (cy - rect.top) / cellSize;
    if (fi < 0 || fi >= 8 || ri < 0 || ri >= 8) return null;
    const f = perspective === 'w' ? Math.floor(fi) : 7 - Math.floor(fi);
    const r = perspective === 'w' ? 7 - Math.floor(ri) : Math.floor(ri);
    return r * 8 + f;
  }, [cellSize, perspective]);

  const clientFromSq = useCallback((s: Square) => {
    const g = gridRef.current;
    if (!g) return null;
    const rect = g.getBoundingClientRect();
    const f = fileOf(s);
    const r = rankOf(s);
    const displayF = perspective === 'w' ? f : 7 - f;
    const displayR = perspective === 'w' ? 7 - r : r;
    return {
      x: rect.left + displayF * cellSize + cellSize / 2,
      y: rect.top + displayR * cellSize + cellSize / 2,
    };
  }, [cellSize, perspective]);

  // ── Legal targets ───────────────────────────────────────────────────────────
  const targetSrc = drag?.src ?? selected;
  const legalTargets: Set<Square> | undefined =
    interaction?.mode === 'move' && targetSrc !== null
      ? interaction.getTargets(targetSrc)
      : interaction?.mode === 'drop'
      ? interaction.dropTargets
      : undefined;

  // ── Pointer interaction ─────────────────────────────────────────────────────
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if (!interaction) return;
    e.preventDefault();

    const s = sqFromClient(e.clientX, e.clientY);
    if (s === null) return;

    // Promotion pick: click only
    if (interaction.mode === 'promotion-pick') {
      const { onPick, onCancel, validSquares } = interaction;
      const piece = board[s];
      document.addEventListener('pointerup', () => {
        const isValid = piece
          && piece.color === promotionPickColor
          && piece.type !== 'K' && piece.type !== 'P'
          && (!validSquares || validSquares.has(s));
        if (isValid) onPick(s); else onCancel?.();
      }, { once: true });
      return;
    }

    // Drop mode
    if (interaction.mode === 'drop') {
      const { dropTargets, onDrop, onCancel, getMoveTargets, onMove: onMovePiece } = interaction;
      if (!dropTargets.has(s)) {
        onCancel?.();
        const piece = board[s];
        if (piece && getMoveTargets && onMovePiece) {
          const targets = getMoveTargets(s);
          setSelected(s);
          const startX = e.clientX;
          const startY = e.clientY;
          let dragging = false;
          const onPMove = (me: PointerEvent) => {
            if (!dragging) {
              const dx = me.clientX - startX;
              const dy = me.clientY - startY;
              if (dx * dx + dy * dy > DRAG_PX * DRAG_PX) dragging = true;
            }
            if (dragging) {
              setDrag({ src: s, piece, x: me.clientX, y: me.clientY, hover: sqFromClient(me.clientX, me.clientY) });
            }
          };
          const onPUp = (ue: PointerEvent) => {
            document.removeEventListener('pointermove', onPMove);
            if (dragging) {
              const toSq = sqFromClient(ue.clientX, ue.clientY);
              if (toSq !== null && targets.has(toSq)) {
                lastOwnMoveDest.current = toSq;
                setSnapAnim({ piece, fromSquare: s, toSquare: toSq, cursorX: ue.clientX, cursorY: ue.clientY });
                onMovePiece(s, toSq);
              } else {
                setSnapAnim({ piece, fromSquare: s, toSquare: s, cursorX: ue.clientX, cursorY: ue.clientY });
              }
              setDrag(null);
              setSelected(null);
            }
          };
          document.addEventListener('pointermove', onPMove);
          document.addEventListener('pointerup', onPUp, { once: true });
        } else if (board[s]) {
          setSelected(s);
        }
        return;
      }
      document.addEventListener('pointerup', (ue: PointerEvent) => {
        const toSq = sqFromClient(ue.clientX, ue.clientY);
        if (toSq !== null && dropTargets.has(toSq)) onDrop(toSq);
      }, { once: true });
      return;
    }

    // Move mode
    onCancelPremove?.();
    const piece = board[s];

    // Piece already selected → clicking a legal target moves there
    if (selected !== null && selected !== s) {
      const targets = interaction.getTargets(selected);
      if (targets.has(s)) {
        const sel = selected;
        const { onMove } = interaction;
        document.addEventListener('pointerup', (ue: PointerEvent) => {
          const upSq = sqFromClient(ue.clientX, ue.clientY);
          const dest = upSq !== null && targets.has(upSq) ? upSq : s;
          onMove(sel, dest);
          setSelected(null);
        }, { once: true });
        return;
      }
    }

    if (!piece) { setSelected(null); return; }

    const { getTargets, onMove } = interaction;
    const targets = getTargets(s);
    const wasSelected = selected === s;
    setSelected(s);

    const startX = e.clientX;
    const startY = e.clientY;
    let dragging = false;

    const onPMove = (me: PointerEvent) => {
      if (!dragging) {
        const dx = me.clientX - startX;
        const dy = me.clientY - startY;
        if (dx * dx + dy * dy > DRAG_PX * DRAG_PX) dragging = true;
      }
      if (dragging) {
        setDrag({ src: s, piece, x: me.clientX, y: me.clientY, hover: sqFromClient(me.clientX, me.clientY) });
      }
    };

    const onPUp = (ue: PointerEvent) => {
      document.removeEventListener('pointermove', onPMove);
      if (dragging) {
        const toSq = sqFromClient(ue.clientX, ue.clientY);
        if (toSq !== null && targets.has(toSq)) {
          lastOwnMoveDest.current = toSq;
          setSnapAnim({ piece, fromSquare: s, toSquare: toSq, cursorX: ue.clientX, cursorY: ue.clientY });
          onMove(s, toSq);
        } else {
          // Snap back to source square
          setSnapAnim({ piece, fromSquare: s, toSquare: s, cursorX: ue.clientX, cursorY: ue.clientY });
        }
        setDrag(null);
        setSelected(null);
      } else if (wasSelected) {
        setSelected(null);
      }
    };

    document.addEventListener('pointermove', onPMove);
    document.addEventListener('pointerup', onPUp, { once: true });
  }, [interaction, board, selected, sqFromClient, promotionPickColor, onCancelPremove]);

  // ── Render ──────────────────────────────────────────────────────────────────
  const isLight = (f: number, r: number) => (f + r) % 2 === 1;
  const ranks = perspective === 'w' ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  const files = perspective === 'w' ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];

  // Squares hidden while snap animation owns the visual
  const snapHideSq = snapAnim ? new Set<Square>([snapAnim.fromSquare, snapAnim.toSquare]) : null;

  return (
    <div style={{ display: 'inline-block', userSelect: 'none', touchAction: 'none' }}>
      {label && (
        <div style={{
          textAlign: 'center', marginBottom: 6,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
          color: 'rgba(255,255,255,0.4)',
          textTransform: 'uppercase',
        }}>{label}</div>
      )}

      <div
        ref={gridRef}
        onPointerMove={(e) => setHoverSquare(sqFromClient(e.clientX, e.clientY))}
        onPointerLeave={() => setHoverSquare(null)}
        style={{
          position: 'relative',
          width: cellSize * 8,
          height: cellSize * 8,
          borderRadius: 6,
          overflow: 'hidden',
          boxShadow: '0 12px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.07)',
          cursor: drag ? 'grabbing' : 'default',
          touchAction: 'none',
        }}
        onPointerDown={handlePointerDown}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* ── Layer 1: Square backgrounds + highlights ── */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'grid',
          gridTemplateColumns: `repeat(8, ${cellSize}px)`,
          gridTemplateRows: `repeat(8, ${cellSize}px)`,
        }}>
          {ranks.map((r) => files.map((f) => {
            const s = sq(f, r);
            const light = isLight(f, r);
            const isSelected = selected === s;
            const isDragSrc = drag?.src === s;
            const isTarget = legalTargets?.has(s);
            const boardPiece = board[s];
            const isHoverTarget = drag !== null && drag.hover === s && !!isTarget;
            const isPending = pendingPromoSquare === s;
            const isPromoPickable = interaction?.mode === 'promotion-pick'
              && boardPiece && boardPiece.color === promotionPickColor
              && boardPiece.type !== 'K' && boardPiece.type !== 'P';
            const isPremove = !!premove && (
              premove.type === 'move'
                ? (premove.from === s || premove.to === s)
                : premove.to === s
            );
            const showRankLabel = f === (perspective === 'w' ? 0 : 7);
            const showFileLabel = r === (perspective === 'w' ? 0 : 7);

            return (
              <div
                key={s}
                data-square={s}
                style={{ width: cellSize, height: cellSize, background: light ? cs.light : cs.dark, position: 'relative' }}
              >
                {lastMove && (lastMove.from === s || lastMove.to === s) && (
                  <div style={{ position: 'absolute', inset: 0, background: cs.lastMove, pointerEvents: 'none' }} />
                )}
                {isPremove && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(167,139,250,0.45)', pointerEvents: 'none' }} />
                )}
                {(isSelected || isDragSrc) && (
                  <div style={{ position: 'absolute', inset: 0, background: cs.selected, pointerEvents: 'none' }} />
                )}
                {isHoverTarget && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(86,219,211,0.5)', pointerEvents: 'none' }} />
                )}
                {isTarget && !isHoverTarget && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                    {boardPiece
                      ? <div style={{ width: '100%', height: '100%', boxShadow: `inset 0 0 0 4px ${cs.legal.replace(/[\d.]+\)$/, '0.8)')}` }} />
                      : <div style={{ width: cellSize * 0.32, height: cellSize * 0.32, borderRadius: '50%', background: cs.legal }} />
                    }
                  </div>
                )}
                {isPending && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,159,0,0.55)', pointerEvents: 'none' }} />
                )}
                {isPromoPickable && (
                  <div style={{ position: 'absolute', inset: 0, background: cs.selected, pointerEvents: 'none' }} />
                )}
                {showRankLabel && (
                  <span style={{
                    position: 'absolute', left: 3, top: 2, fontSize: coordSize, lineHeight: 1, zIndex: 2,
                    fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, pointerEvents: 'none',
                    color: light ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.55)',
                  }}>{r + 1}</span>
                )}
                {showFileLabel && (
                  <span style={{
                    position: 'absolute', right: 3, bottom: 1, fontSize: coordSize, lineHeight: 1, zIndex: 2,
                    fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, pointerEvents: 'none',
                    color: light ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.55)',
                  }}>{String.fromCharCode('a'.charCodeAt(0) + f)}</span>
                )}
              </div>
            );
          }))}
        </div>

        {/* ── Layer 2: Pieces (stable identity, CSS transitions for sliding) ── */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {stablePieces.map(piece => {
            const f = fileOf(piece.square);
            const r = rankOf(piece.square);
            const displayF = perspective === 'w' ? f : 7 - f;
            const displayR = perspective === 'w' ? 7 - r : r;
            const tx = displayF * cellSize;
            const ty = displayR * cellSize;

            const isDragSrc = !piece.exiting && drag?.src === piece.square;
            const isHiddenBySnap = !piece.exiting && !!snapHideSq?.has(piece.square);

            return (
              <div
                key={piece.id}
                style={{
                  position: 'absolute',
                  width: cellSize,
                  height: cellSize,
                  transform: `translate3d(${tx}px, ${ty}px, 0)`,
                  transition: piece.noTransition
                    ? 'none'
                    : piece.exiting
                    ? 'opacity 140ms linear'
                    : 'transform 200ms cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                  opacity: piece.exiting ? 0 : isDragSrc ? 0.12 : isHiddenBySnap ? 0 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  willChange: piece.noTransition ? undefined : 'transform',
                }}
              >
                <ChessPiece
                  piece={piece.type as PieceType}
                  color={piece.color}
                  size={pieceSize}
                  pieceSet={pieceSet}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating piece that follows the cursor during drag (no scale, heavy shadow for lift) */}
      {drag && (
        <div style={{
          position: 'fixed', left: 0, top: 0,
          transform: `translate3d(${drag.x - pieceSize / 2}px, ${drag.y - pieceSize / 2}px, 0)`,
          width: pieceSize, height: pieceSize,
          pointerEvents: 'none', zIndex: 1000,
          filter: 'drop-shadow(0 8px 20px rgba(0,0,0,0.9)) drop-shadow(0 2px 5px rgba(0,0,0,0.6))',
          willChange: 'transform',
        }}>
          <ChessPiece
            piece={drag.piece.type as PieceType}
            color={drag.piece.color}
            size={pieceSize}
            pieceSet={pieceSet}
          />
        </div>
      )}

      {/* Snap animation: piece travels from cursor to dest square (or back to source) */}
      {snapAnim && (
        <div
          ref={snapRef}
          style={{
            position: 'fixed', left: 0, top: 0,
            // Initial position is cursor — useLayoutEffect will animate to dest
            transform: `translate3d(${snapAnim.cursorX - pieceSize / 2}px, ${snapAnim.cursorY - pieceSize / 2}px, 0)`,
            width: pieceSize, height: pieceSize,
            pointerEvents: 'none', zIndex: 1000,
            filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.6))',
            willChange: 'transform',
          }}
          onTransitionEnd={() => setSnapAnim(null)}
        >
          <ChessPiece
            piece={snapAnim.piece.type as PieceType}
            color={snapAnim.piece.color}
            size={pieceSize}
            pieceSet={pieceSet}
          />
        </div>
      )}
    </div>
  );
}
