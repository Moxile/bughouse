import React from 'react';
import { Color, DropPieceType, Hand } from '@bughouse/shared';
import { ChessPiece, PieceType } from './ChessPiece.js';
import { ColorScheme, DEFAULT_SCHEME } from '../themes.js';

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const PIECE_ORDER: DropPieceType[] = ['Q', 'R', 'B', 'N', 'P'];
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
};

export function HandPanel({ hand, color, selectedPiece, onSelect, canInteract, canDrag, large, cellSize, onDragStart, onDragEnd, colorScheme = DEFAULT_SCHEME }: Props) {
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
      {!hasPieces && (
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          color: 'rgba(255,255,255,0.2)',
          letterSpacing: 0.5,
        }}>— empty pocket</span>
      )}
      {PIECE_ORDER.map((pt) => {
        const count = hand[pt];
        if (count <= 0) return null;
        const isSelected = selectedPiece === pt;
        return (
          <button
            key={pt}
            onPointerDown={(e: React.PointerEvent) => {
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

              const onPUp = (ue: PointerEvent) => {
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
              border: isSelected
                ? `1px solid ${cs.selected.replace(/[\d.]+\)$/, '0.8)')}`
                : `1px solid ${hexToRgba(cs.dark, 0.35)}`,
              background: isSelected
                ? cs.selected
                : hexToRgba(cs.light, 0.10),
              cursor: canDrag ? 'grab' : canInteract ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: isSelected ? `0 0 0 2px ${cs.selected.replace(/[\d.]+\)$/, '0.3)')}` : 'none',
              transition: 'border-color 120ms ease, background 120ms ease, box-shadow 120ms ease',
              padding: 3,
              touchAction: 'none',
            }}
            title={`Drop ${pt} (${count})`}
          >
            <ChessPiece piece={pt as PieceType} color={color} size={iconSize} />
            {count > 1 && (
              <span style={{
                position: 'absolute',
                bottom: -4, right: -4,
                background: '#0a0a0a',
                color: '#fff',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: large ? 10 : 9,
                fontWeight: 700,
                padding: '1px 4px',
                borderRadius: 4,
                border: '1px solid rgba(255,255,255,0.12)',
                lineHeight: 1.2,
              }}>×{count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
