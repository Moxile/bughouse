import React, { useCallback, useEffect, useRef, useState } from 'react';
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
    x: number;
    y: number;
    hover: Square | null;
  } | null>(null);
  const [releaseAnim, setReleaseAnim] = useState<{
    piece: NonNullable<typeof board[number]>;
    from: Square;
    to: Square;
    startX: number;
    startY: number;
  } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Global grabbing cursor while dragging
  const isDragging = drag !== null;
  useEffect(() => {
    if (!isDragging) return;
    document.body.style.cursor = 'grabbing';
    return () => { document.body.style.cursor = ''; };
  }, [isDragging]);

  // Cancel promotion if the user clicks anywhere outside the board
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

  useEffect(() => {
    const pieceMap: Record<string, DropPieceType> = {
      '1': 'P', '2': 'N', '3': 'B', '4': 'R', '5': 'Q',
    };

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

  // Show targets from the dragged piece or from the click-selected piece
  const targetSrc = drag?.src ?? selected;
  const legalTargets: Set<Square> | undefined =
    interaction?.mode === 'move' && targetSrc !== null
      ? interaction.getTargets(targetSrc)
      : interaction?.mode === 'drop'
      ? interaction.dropTargets
      : undefined;

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if (!interaction) return;
    e.preventDefault();

    const s = sqFromClient(e.clientX, e.clientY);
    if (s === null) return;

    // Promotion pick: click only, no drag
    if (interaction.mode === 'promotion-pick') {
      const { onPick, onCancel, validSquares } = interaction;
      const piece = board[s];
      document.addEventListener('pointerup', () => {
        const isValid = piece &&
          piece.color === promotionPickColor &&
          piece.type !== 'K' &&
          piece.type !== 'P' &&
          (!validSquares || validSquares.has(s));
        if (isValid) {
          onPick(s);
        } else {
          onCancel?.();
        }
      }, { once: true });
      return;
    }

    // Drop mode: clicking any valid target drops there, or drag to target
    if (interaction.mode === 'drop') {
      const { dropTargets, onDrop, onCancel, getMoveTargets, onMove: onMovePiece } = interaction;
      if (!dropTargets.has(s)) {
        // Clicked outside valid drop targets: cancel hand selection and treat
        // this press as a normal piece press (select + optional drag).
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
              const hover = sqFromClient(me.clientX, me.clientY);
              setDrag({ src: s, x: me.clientX, y: me.clientY, hover });
            }
          };
          const onPUp = (ue: PointerEvent) => {
            document.removeEventListener('pointermove', onPMove);
            if (dragging) {
              const toSq = sqFromClient(ue.clientX, ue.clientY);

              if (toSq !== null && targets.has(toSq)) {
                const piece = board[s];

                if (piece) {
                  setReleaseAnim({
                    piece,
                    from: s,
                    to: toSq,
                    startX: ue.clientX,
                    startY: ue.clientY,
                  });
                }

                onMove(s, toSq);
              }

              setDrag(null);
              setSelected(null);
            }
            // else: piece stays selected for a follow-up click
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

    // Piece already selected: clicking a legal target moves there
    if (selected !== null && selected !== s) {
      const targets = interaction.getTargets(selected);
      if (targets.has(s)) {
        const sel = selected;
        const { onMove } = interaction;
        document.addEventListener('pointerup', (ue: PointerEvent) => {
          // Allow slight cursor drift: use release sq if it's also valid
          const upSq = sqFromClient(ue.clientX, ue.clientY);
          const dest = upSq !== null && targets.has(upSq) ? upSq : s;
          onMove(sel, dest);
          setSelected(null);
        }, { once: true });
        return;
      }
    }

    // Clicking an empty non-target square: deselect
    if (!piece) {
      setSelected(null);
      return;
    }

    // Pressing on a piece: select it and start tracking for potential drag
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
        const hover = sqFromClient(me.clientX, me.clientY);
        setDrag({ src: s, x: me.clientX, y: me.clientY, hover });
      }
    };

    const onPUp = (ue: PointerEvent) => {
      document.removeEventListener('pointermove', onPMove);
      if (dragging) {
        setDrag(null);
        const toSq = sqFromClient(ue.clientX, ue.clientY);
        if (toSq !== null && targets.has(toSq)) {
          onMove(s, toSq);
        }
        setSelected(null);
      } else if (wasSelected) {
        // Re-clicking the already-selected piece deselects it
        setSelected(null);
      }
      // Otherwise: piece was freshly selected, keep it selected
    };

    document.addEventListener('pointermove', onPMove);
    document.addEventListener('pointerup', onPUp, { once: true });
  }, [interaction, board, selected, sqFromClient, promotionPickColor, onCancelPremove]);

  const pieceSize = Math.round(cellSize * 0.82);
  const coordSize = Math.max(8, Math.round(cellSize * 0.18));
  const isLight = (f: number, r: number) => (f + r) % 2 === 1;

  const ranks = perspective === 'w'
    ? [7, 6, 5, 4, 3, 2, 1, 0]
    : [0, 1, 2, 3, 4, 5, 6, 7];
  const files = perspective === 'w'
    ? [0, 1, 2, 3, 4, 5, 6, 7]
    : [7, 6, 5, 4, 3, 2, 1, 0];

  const draggingPiece = drag !== null ? board[drag.src] : null;

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
        onPointerMove={(e) => {
        setHoverSquare(
            sqFromClient(e.clientX, e.clientY)
          );
        }}
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(8, ${cellSize}px)`,
          gridTemplateRows: `repeat(8, ${cellSize}px)`,
          borderRadius: 6,
          overflow: 'hidden',
          boxShadow: '0 12px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.07)',
          cursor: drag ? 'grabbing' : 'default',
        }}
        onPointerDown={handlePointerDown}
        onContextMenu={(e) => e.preventDefault()}
      >
        {ranks.map((r) =>
          files.map((f) => {
            const s = sq(f, r);
            const piece = board[s];
            const light = isLight(f, r);
            const isSelected = selected === s;
            const isDragSrc = drag?.src === s;
            const isTarget = legalTargets?.has(s);
            const isHoverTarget = drag !== null && drag.hover === s && !!isTarget;
            const isPending = pendingPromoSquare === s;
            const isPromoPickable = interaction?.mode === 'promotion-pick'
              && piece && piece.color === promotionPickColor
              && piece.type !== 'K' && piece.type !== 'P';
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
                style={{
                  width: cellSize, height: cellSize,
                  background: light ? cs.light : cs.dark,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: pieceSize, lineHeight: 1,
                  position: 'relative',
                }}
              >
                {/* Last move highlight */}
                {lastMove && (lastMove.from === s || lastMove.to === s) && (
                  <div style={{ position: 'absolute', inset: 0, background: cs.lastMove, pointerEvents: 'none' }} />
                )}

                {/* Premove highlight */}
                {isPremove && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(167,139,250,0.45)', pointerEvents: 'none' }} />
                )}

                {/* Selection / drag-source highlight */}
                {(isSelected || isDragSrc) && (
                  <div style={{ position: 'absolute', inset: 0, background: cs.selected, boxShadow: `inset 0 0 0 3px ${cs.selected.replace(/[\d.]+\)$/, '1)')}`, pointerEvents: 'none' }} />
                )}

                {/* Hover highlight: valid landing square under the dragged piece */}
                {isHoverTarget && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(86,219,211,0.5)', pointerEvents: 'none' }} />
                )}

                {/* Legal target indicators (dots / rings) */}
                {isTarget && !isHoverTarget && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                    {piece ? (
                      <div style={{ width: '100%', height: '100%', boxShadow: `inset 0 0 0 4px ${cs.legal.replace(/[\d.]+\)$/, '0.8)')}` }} />
                    ) : (
                      <div style={{ width: cellSize * 0.32, height: cellSize * 0.32, borderRadius: '50%', background: cs.legal }} />
                    )}
                  </div>
                )}

                {/* Pending promotion highlight */}
                {isPending && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,159,0,0.55)', pointerEvents: 'none' }} />
                )}

                {/* Promotion pick highlight */}
                {isPromoPickable && (
                  <div style={{ position: 'absolute', inset: 0, background: cs.selected, pointerEvents: 'none' }} />
                )}

                {/* Rank label */}
                {showRankLabel && (
                  <span style={{
                    position: 'absolute', left: 3, top: 2,
                    fontSize: coordSize,
                    fontFamily: "'JetBrains Mono', monospace",
                    fontWeight: 600,
                    color: light ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.55)',
                    pointerEvents: 'none',
                    lineHeight: 1,
                    zIndex: 2,
                  }}>
                    {r + 1}
                  </span>
                )}

                {/* File label */}
                {showFileLabel && (
                  <span style={{
                    position: 'absolute', right: 3, bottom: 1,
                    fontSize: coordSize,
                    fontFamily: "'JetBrains Mono', monospace",
                    fontWeight: 600,
                    color: light ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.55)',
                    pointerEvents: 'none',
                    lineHeight: 1,
                    zIndex: 2,
                  }}>
                    {String.fromCharCode('a'.charCodeAt(0) + f)}
                  </span>
                )}

                {/* Piece — ghost (low opacity) while being dragged from here */}
                {piece && (
                  <div style={{
                    position: 'relative', zIndex: 3,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    opacity:
                      isDragSrc ||
                      (releaseAnim && releaseAnim.from === s)
                        ? 0.25
                        : 1,
                    pointerEvents: 'none',
                    cursor: drag ? 'grabbing' : (interaction?.mode === 'move' ? 'grab' : 'pointer'),
                  }}>
                    <ChessPiece
                      piece={piece.type as PieceType}
                      color={piece.color}
                      size={pieceSize}
                      pieceSet={pieceSet}
                    />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      

      {/* Floating piece that follows the cursor during drag */}
      {draggingPiece && drag && (
        <div style={{
          position: 'fixed',
          left: 0,
          top: 0,
          transform: `translate(${drag.x - Math.round(pieceSize * 1.2) / 2}px, ${drag.y - Math.round(pieceSize * 1.2) / 2}px)`,
          width: pieceSize * 1.2,
          height: pieceSize * 1.2,
          pointerEvents: 'none',
          zIndex: 1000,
          filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.75))',
          willChange: 'transform',
        }}>
          <ChessPiece
            piece={draggingPiece.type as PieceType}
            color={draggingPiece.color}
            size={Math.round(pieceSize * 1.2)}
            pieceSet={pieceSet}
          />
        </div>

      )}
      {releaseAnim && clientFromSq(releaseAnim.to) && (
  <div
    style={{
      position: 'fixed',
      left: 0,
      top: 0,
      width: pieceSize * 1.2,
      height: pieceSize * 1.2,
      pointerEvents: 'none',
      zIndex: 1000,
      transform: `translate(
        ${clientFromSq(releaseAnim.to)!.x - (pieceSize * 1.2) / 2}px,
        ${clientFromSq(releaseAnim.to)!.y - (pieceSize * 1.2) / 2}px
      )`,
      transition: 'transform 90ms ease-out',
    }}
    onTransitionEnd={() => {
      setReleaseAnim(null);
    }}
  >
    <ChessPiece
      piece={releaseAnim.piece.type as PieceType}
      color={releaseAnim.piece.color}
      size={Math.round(pieceSize * 1.2)}
      pieceSet={pieceSet}
    />
  </div>
)}
    </div>
  );
}
