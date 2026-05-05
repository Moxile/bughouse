import React, { useCallback, useState } from 'react';
import {
  Board as BoardType,
  Color,
  DropPieceType,
  Hand,
  Piece,
  Square,
  fileOf,
  rankOf,
  sq,
} from '@bughouse/shared';

const PIECE_SYMBOLS: Record<string, string> = {
  wK: '♔', wQ: '♕', wR: '♖', wB: '♗', wN: '♘', wP: '♙',
  bK: '♚', bQ: '♛', bR: '♜', bB: '♝', bN: '♞', bP: '♟',
};

function pieceSymbol(p: Piece): string {
  return PIECE_SYMBOLS[`${p.color}${p.type}`] ?? '?';
}

export type BoardInteraction =
  | { mode: 'move'; onMove: (from: Square, to: Square) => void; getTargets: (from: Square) => Set<Square> }
  | { mode: 'drop'; piece: DropPieceType; dropTargets: Set<Square>; onDrop: (to: Square) => void }
  | { mode: 'promotion-pick'; onPick: (sq: Square) => void };

type Props = {
  board: BoardType;
  perspective: Color;
  interaction: BoardInteraction | null;
  // Highlight pending promotion square.
  pendingPromoSquare?: Square | null;
  // If in promotion-pick mode, highlight the pieces eligible to pick (non-king, non-pawn of the given color).
  promotionPickColor?: Color;
  label?: string;
  // Queued premove to highlight (from/to in coral).
  premove?: { from: Square; to: Square } | null;
  // Called when a click in move mode doesn't complete a new premove/move.
  onCancelPremove?: () => void;
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
}: Props) {
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
      if (!piece || piece.color !== promotionPickColor || piece.type === 'K' || piece.type === 'P') return;
      interaction.onPick(s);
      return;
    }
    if (interaction.mode === 'drop') {
      if (board[s]) return; // occupied
      interaction.onDrop(s);
      return;
    }
    // Move mode: cancel any queued premove on every click; onMove will re-set one if applicable.
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
        setSelected(s); // re-select another piece
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

  return (
    <div style={{ display: 'inline-block', userSelect: 'none' }}>
      {label && <div style={{ textAlign: 'center', marginBottom: 4, fontWeight: 'bold' }}>{label}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 56px)', gridTemplateRows: 'repeat(8, 56px)', border: '2px solid #555' }}>
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
            const isPremove = !!premove && (premove.from === s || premove.to === s);

            let bg = light ? '#f0d9b5' : '#b58863';
            if (isPremove)       bg = '#f4a07a';
            if (isSelected)      bg = '#f6f669';
            if (isTarget)        bg = light ? '#cdd16e' : '#aaa23a';
            if (isPending)       bg = '#ff9f00';
            if (isPromoPickable) bg = '#60c0ff';

            const canDrag = interaction?.mode === 'move' && piece !== null;

            return (
              <div
                key={s}
                style={{
                  width: 56, height: 56, background: bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: interaction ? 'pointer' : 'default',
                  fontSize: 38, lineHeight: 1,
                  position: 'relative',
                }}
                onClick={() => handleSquareClick(s)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, s)}
              >
                {piece && (
                  <span
                    draggable={canDrag}
                    onDragStart={canDrag ? (e) => handleDragStart(e, s) : undefined}
                    style={{ cursor: canDrag ? 'grab' : undefined }}
                  >
                    {pieceSymbol(piece)}
                  </span>
                )}
                {isTarget && !piece && (
                  <div style={{
                    position: 'absolute', width: 18, height: 18, borderRadius: '50%',
                    background: 'rgba(0,0,0,0.2)',
                  }} />
                )}
                {/* Rank/file labels on outer edges */}
                {f === (perspective === 'w' ? 0 : 7) && (
                  <span style={{ position: 'absolute', top: 2, left: 3, fontSize: 11, color: light ? '#b58863' : '#f0d9b5', fontWeight: 'bold' }}>
                    {r + 1}
                  </span>
                )}
                {r === (perspective === 'w' ? 0 : 7) && (
                  <span style={{ position: 'absolute', bottom: 2, right: 3, fontSize: 11, color: light ? '#b58863' : '#f0d9b5', fontWeight: 'bold' }}>
                    {String.fromCharCode('a'.charCodeAt(0) + f)}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
