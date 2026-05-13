import React from 'react';
import { Color, DropPieceType, Hand } from '@bughouse/shared';
import { ChessPiece, PieceType } from './ChessPiece.js';
import { ColorScheme, DEFAULT_SCHEME } from '../themes.js';
import { PieceSet, DEFAULT_PIECE_SET } from '../pieceSets.js';

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const PIECE_ORDER: DropPieceType[] = ['P', 'N', 'B', 'R', 'Q'];
const DRAG_PX = 5;

type Props = {
  hand: Hand;
  color: Color;
  selectedPiece: DropPieceType | null;
  onSelect: (piece: DropPieceType | null) => void;
  canInteract: boolean;
  canDrag?: boolean;
  large?: boolean;
  cellSize?: number;
  onDragStart?: (piece: DropPieceType) => void;
  onDragEnd?: () => void;
  colorScheme?: ColorScheme;
  pieceSet?: PieceSet;
};

export function HandPanel({ hand, color, selectedPiece, onSelect, canInteract, canDrag, large, cellSize, onDragStart, onDragEnd, colorScheme = DEFAULT_SCHEME, pieceSet = DEFAULT_PIECE_SET }: Props) {
  const cs = colorScheme;
  const sz = cellSize !== undefined
    ? Math.max(40, Math.round(cellSize * 0.85))
    : (large ? 44 : 32);
  const iconSize = cellSize !== undefined
    ? Math.max(28, Math.round(cellSize * 0.72))
    : (large ? 26 : 20);

  const hasPieces = PIECE_ORDER.some((pt) => hand[pt] > 0);

  return (
    <div style={{
      display: 'flex',
      gap: 5,
      padding: `6px 10px`,
      minHeight: sz + 14,
      alignItems: 'center',
      flexWrap: 'wrap',
    }}>
      {PIECE_ORDER.map((pt) => {
        const count = hand[pt];
        const isSelected = selectedPiece === pt;
        const hasPiece = count > 0;
        return (
          <button
            key={pt}
            disabled={!hasPiece}
            onPointerDown={(e: React.PointerEvent) => {
              if (!hasPiece) return;

              if (e.button !== 0) return;
              if (!canDrag && !canInteract) return;

              e.preventDefault();

              const startX = e.clientX;
              const startY = e.clientY;
              let dragging = false;

              const onPMove = (me: PointerEvent) => {
                if (!dragging && canDrag) {
                  const dx = me.clientX - startX;
                  const dy = me.clientY - startY;

                  if (dx * dx + dy * dy > DRAG_PX * DRAG_PX) {
                    dragging = true;
                    onDragStart?.(pt);
                  }
                }
              };

              const onPUp = () => {
                document.removeEventListener('pointermove', onPMove);

                if (dragging) {
                  onDragEnd?.();
                } else if (canInteract) {
                  onSelect(isSelected ? null : pt);
                }
              };

              document.addEventListener('pointermove', onPMove);
              document.addEventListener('pointerup', onPUp, { once: true });
            }}
            style={{
              position: 'relative',
              width: sz,
              height: sz,
              borderRadius: 6,

              opacity: hasPiece ? 1 : 0.18,

              border: isSelected
                ? `1px solid ${cs.selected.replace(/[\d.]+\)$/, '0.8)')}`
                : `1px solid ${hexToRgba(cs.dark, 0.35)}`,

              background: isSelected
                ? cs.selected
                : hexToRgba(cs.light, 0.10),

              cursor: hasPiece
                ? (canDrag ? 'grab' : canInteract ? 'pointer' : 'default')
                : 'default',

              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',

              padding: 3,
            }}
          >
            {hasPiece && (
              <>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                  height: '100%',
                }}>
                  <ChessPiece
                    piece={pt as PieceType}
                    color={color}
                    size={iconSize}
                    pieceSet={pieceSet}
                  />
                </div>

                {count > 1 && (
                  <div style={{
                    position: 'absolute',
                    top: -5,
                    right: -5,

                    minWidth: 16,
                    height: 16,

                    padding: '0 4px',

                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',

                    background: 'rgba(8,8,8,0.96)',
                    color: '#fff',

                    borderRadius: 999,
                    border: '1px solid rgba(255,255,255,0.12)',

                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 9,
                    fontWeight: 700,
                    lineHeight: 1,

                    boxShadow: '0 2px 6px rgba(0,0,0,0.45)',
                    pointerEvents: 'none',
                  }}>
                    {count}
                  </div>
                )}
              </>
            )}
          </button>
        );
      })}

    </div>
  );
}
