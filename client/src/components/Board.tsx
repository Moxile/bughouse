import React, { useCallback, useState } from 'react';
import {
  Board as BoardType,
  Color,
  DropPieceType,
  Piece,
  Square,
  fileOf,
  rankOf,
  sq,
} from '@bughouse/shared';
import { ChessPiece, PieceType } from './ChessPiece.js';
import { ColorScheme, DEFAULT_SCHEME } from '../themes.js';

export type PremoveState =
  | { type: 'move'; from: Square; to: Square }
  | { type: 'drop'; piece: DropPieceType; to: Square };

export type BoardInteraction =
  | { mode: 'move'; onMove: (from: Square, to: Square) => void; getTargets: (from: Square) => Set<Square> }
  | { mode: 'drop'; piece: DropPieceType; dropTargets: Set<Square>; onDrop: (to: Square) => void }
  | { mode: 'promotion-pick'; onPick: (sq: Square) => void; onCancel?: () => void };

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
};

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
}: Props) {
  const cs = colorScheme;
  const [selected, setSelected] = useState<Square | null>(null);
  const [dragFrom, setDragFrom] = useState<Square | 'hand' | null>(null);

  const legalTargets: Set<Square> | undefined =
    interaction?.mode === 'move' && selected !== null
      ? interaction.getTargets(selected)
      : interaction?.mode === 'drop'
      ? interaction.dropTargets
      : undefined;

  const ranks = perspective === 'w'
    ? [7, 6, 5, 4, 3, 2, 1, 0]
    : [0, 1, 2, 3, 4, 5, 6, 7];
  const files = perspective === 'w'
    ? [0, 1, 2, 3, 4, 5, 6, 7]
    : [7, 6, 5, 4, 3, 2, 1, 0];

  const handleSquareClick = useCallback((s: Square) => {
    if (!interaction) return;
    if (interaction.mode === 'promotion-pick') {
      const piece = board[s];
      if (!piece || piece.color !== promotionPickColor || piece.type === 'K' || piece.type === 'P') {
        interaction.onCancel?.();
        return;
      }
      interaction.onPick(s);
      return;
    }
    if (interaction.mode === 'drop') {
      if (board[s]) return;
      interaction.onDrop(s);
      return;
    }
    onCancelPremove?.();
    const piece = board[s];
    if (selected === null) {
      if (piece) setSelected(s);
    } else {
      if (s === selected) { setSelected(null); return; }
      if (legalTargets?.has(s)) {
        interaction.onMove(selected, s);
        setSelected(null);
      } else if (piece) {
        setSelected(s);
      } else {
        setSelected(null);
      }
    }
  }, [interaction, selected, legalTargets, board, promotionPickColor, onCancelPremove]);

  const handleDragStart = useCallback((e: React.DragEvent, s: Square) => {
    setDragFrom(s);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, s: Square) => {
    e.preventDefault();
    if (!interaction) return;
    if (interaction.mode === 'promotion-pick') {
      const piece = board[s];
      if (!piece || piece.color !== promotionPickColor || piece.type === 'K' || piece.type === 'P') return;
      interaction.onPick(s);
    } else if (interaction.mode === 'drop') {
      if (board[s]) return;
      interaction.onDrop(s);
    } else if (interaction.mode === 'move' && dragFrom !== null && dragFrom !== 'hand') {
      const targets = interaction.getTargets(dragFrom as Square);
      if (targets.has(s)) {
        interaction.onMove(dragFrom as Square, s);
      }
    }
    setDragFrom(null);
  }, [interaction, dragFrom, legalTargets, board, promotionPickColor]);

  const isLight = (f: number, r: number) => (f + r) % 2 === 1;
  const pieceSize = Math.round(cellSize * 0.82);
  const coordSize = Math.max(8, Math.round(cellSize * 0.18));

  return (
    <div style={{ display: 'inline-block', userSelect: 'none' }}>
      {label && (
        <div style={{
          textAlign: 'center', marginBottom: 6,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
          color: 'rgba(255,255,255,0.4)',
          textTransform: 'uppercase',
        }}>{label}</div>
      )}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(8, ${cellSize}px)`,
        gridTemplateRows: `repeat(8, ${cellSize}px)`,
        borderRadius: 6,
        overflow: 'hidden',
        boxShadow: '0 12px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.07)',
      }}>
        {ranks.map((r) =>
          files.map((f) => {
            const s = sq(f, r);
            const piece = board[s];
            const light = isLight(f, r);
            const isSelected = selected === s;
            const isTarget = legalTargets?.has(s);
            const isPending = pendingPromoSquare === s;
            const isPromoPickable = interaction?.mode === 'promotion-pick'
              && piece && piece.color === promotionPickColor
              && piece.type !== 'K' && piece.type !== 'P';
            const isPremove = !!premove && (
              premove.type === 'move'
                ? (premove.from === s || premove.to === s)
                : premove.to === s
            );

            const canDrag = interaction?.mode === 'move' && piece !== null;

            const showRankLabel = f === (perspective === 'w' ? 0 : 7);
            const showFileLabel = r === (perspective === 'w' ? 0 : 7);

            return (
              <div
                key={s}
                style={{
                  width: cellSize, height: cellSize,
                  background: light ? cs.light : cs.dark,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: interaction ? 'pointer' : 'default',
                  fontSize: pieceSize, lineHeight: 1,
                  position: 'relative',
                }}
                onClick={() => handleSquareClick(s)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, s)}
              >
                {/* Premove highlight */}
                {isPremove && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(167,139,250,0.45)', pointerEvents: 'none' }} />
                )}

                {/* Selection highlight */}
                {isSelected && (
                  <div style={{ position: 'absolute', inset: 0, background: cs.selected, boxShadow: `inset 0 0 0 3px ${cs.selected.replace(/[\d.]+\)$/, '1)')}`, pointerEvents: 'none' }} />
                )}

                {/* Legal target indicator */}
                {isTarget && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                    {piece ? (
                      <div style={{ width: '100%', height: '100%', boxShadow: `inset 0 0 0 4px ${cs.legal.replace(/[\d.]+\)$/, '0.8)')}` }} />
                    ) : (
                      <div style={{ width: cellSize * 0.32, height: cellSize * 0.32, borderRadius: '50%', background: cs.legal }} />
                    )}
                  </div>
                )}

                {/* Pending promotion square */}
                {isPending && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,159,0,0.55)', pointerEvents: 'none' }} />
                )}

                {/* Promotion pick highlight */}
                {isPromoPickable && (
                  <div style={{ position: 'absolute', inset: 0, background: cs.selected, pointerEvents: 'none' }} />
                )}

                {/* Rank label (left edge) */}
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

                {/* File label (bottom edge) */}
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

                {/* Piece */}
                {piece && (
                  <div
                    draggable={canDrag}
                    onDragStart={canDrag ? (e) => handleDragStart(e, s) : undefined}
                    style={{
                      cursor: canDrag ? 'grab' : undefined,
                      position: 'relative',
                      zIndex: 3,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <ChessPiece
                      piece={piece.type as PieceType}
                      color={piece.color}
                      size={pieceSize}
                    />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
