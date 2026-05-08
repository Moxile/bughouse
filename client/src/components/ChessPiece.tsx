import React from 'react';
import { Color } from '@bughouse/shared';
import { PieceSet, PieceType, DEFAULT_PIECE_SET } from '../pieceSets.js';

export type { PieceType };

type Props = {
  piece: PieceType;
  color: Color;
  size: number;
  pieceSet?: PieceSet;
};

export function ChessPiece({ piece, color, size, pieceSet = DEFAULT_PIECE_SET }: Props) {
  const fill   = color === 'w' ? '#f5f5f0' : '#1a1a1a';
  const stroke = color === 'w' ? '#1a1a1a' : '#f0f0eb';
  const inner  = pieceSet.paths[piece]?.(fill, stroke) ?? '';

  return (
    <svg
      viewBox="0 0 45 45"
      width={size}
      height={size}
      style={{
        display: 'block',
        filter: color === 'w'
          ? 'drop-shadow(0 1px 3px rgba(0,0,0,0.45))'
          : 'drop-shadow(0 1px 2px rgba(0,0,0,0.7))',
        flexShrink: 0,
      }}
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  );
}
