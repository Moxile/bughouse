import React from 'react';
import { Color, DropPieceType, Hand } from '@bughouse/shared';

const PIECE_SYMBOLS: Record<string, string> = {
  wP: '♙', wN: '♘', wB: '♗', wR: '♖', wQ: '♕',
  bP: '♟', bN: '♞', bB: '♝', bR: '♜', bQ: '♛',
};

const PIECE_ORDER: DropPieceType[] = ['Q', 'R', 'B', 'N', 'P'];

type Props = {
  hand: Hand;
  color: Color;
  selectedPiece: DropPieceType | null;
  onSelect: (piece: DropPieceType | null) => void;
  canInteract: boolean;
  canDrag?: boolean;
  onDragStart?: (piece: DropPieceType) => void;
  onDragEnd?: () => void;
};

export function HandPanel({ hand, color, selectedPiece, onSelect, canInteract, canDrag, onDragStart, onDragEnd }: Props) {
  return (
    <div style={{ display: 'flex', gap: 6, padding: '6px 0', flexWrap: 'wrap', minHeight: 44 }}>
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
              fontSize: 26,
              lineHeight: 1,
              padding: '2px 6px',
              border: `2px solid ${isSelected ? '#2563eb' : '#555'}`,
              borderRadius: 6,
              background: isSelected ? '#dbeafe' : '#fff',
              cursor: canDrag ? 'grab' : canInteract ? 'pointer' : 'default',
              position: 'relative',
            }}
            title={`Drop ${pt} (${count})`}
          >
            {PIECE_SYMBOLS[`${color}${pt}`]}
            <sup style={{ fontSize: 11, fontWeight: 'bold', position: 'absolute', top: 2, right: 3 }}>
              {count}
            </sup>
          </button>
        );
      })}
    </div>
  );
}
