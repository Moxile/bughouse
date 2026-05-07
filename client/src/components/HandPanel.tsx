import React from 'react';
import { Color, DropPieceType, Hand } from '@bughouse/shared';
import { ChessPiece, PieceType } from './ChessPiece.js';

const PIECE_ORDER: DropPieceType[] = ['Q', 'R', 'B', 'N', 'P'];

type Props = {
  hand: Hand;
  color: Color;
  selectedPiece: DropPieceType | null;
  onSelect: (piece: DropPieceType | null) => void;
  canInteract: boolean;
  canDrag?: boolean;
  large?: boolean;
  onDragStart?: (piece: DropPieceType) => void;
  onDragEnd?: () => void;
};

export function HandPanel({ hand, color, selectedPiece, onSelect, canInteract, canDrag, large, onDragStart, onDragEnd }: Props) {
  const sz = large ? 44 : 32;
  const iconSize = large ? 26 : 20;

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
            draggable={canDrag}
            onClick={() => {
              if (!canInteract) return;
              onSelect(isSelected ? null : pt);
            }}
            onDragStart={canDrag ? (e) => {
              e.dataTransfer.effectAllowed = 'move';
              onDragStart?.(pt);
            } : undefined}
            onDragEnd={canDrag ? () => onDragEnd?.() : undefined}
            style={{
              position: 'relative',
              width: sz,
              height: sz,
              borderRadius: 6,
              border: isSelected
                ? '1px solid #56dbd3'
                : '1px solid rgba(255,255,255,0.08)',
              background: isSelected
                ? 'rgba(86,219,211,0.16)'
                : 'rgba(255,255,255,0.04)',
              cursor: canDrag ? 'grab' : canInteract ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: isSelected ? '0 0 0 2px rgba(86,219,211,0.3)' : 'none',
              transition: 'all 120ms ease',
              padding: 3,
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
