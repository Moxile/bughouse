import React from 'react';

interface Props {
  size?: number;
}

// Same split-board-rotated-45° concept as SplitBoardLogo, scaled for small header use.
export function BughouseIcon({ size = 30 }: Props) {
  const SQUARE = 6;
  const COLS = 2;
  const ROWS = 4;
  const GAP = 4;
  const SHIFT = 6;
  const HALF_W = COLS * SQUARE; // 12
  const HALF_H = ROWS * SQUARE; // 24

  const contentW = HALF_W + GAP + HALF_W; // 28
  const contentH = HALF_H + SHIFT;         // 30
  const cx = contentW / 2;                 // 14
  const cy = contentH / 2;                 // 15

  const vbSize = Math.ceil((contentW + contentH) * Math.SQRT1_2) + 2; // ≈ 42

  const tx = vbSize / 2 - cx;
  const ty = vbSize / 2 - cy;

  const half = (lightColor: string, darkColor: string) =>
    Array.from({ length: ROWS }, (_, r) =>
      Array.from({ length: COLS }, (_, c) => (
        <rect
          key={`${r}-${c}`}
          x={c * SQUARE}
          y={r * SQUARE}
          width={SQUARE - 1}
          height={SQUARE - 1}
          fill={(r + c) % 2 === 0 ? lightColor : darkColor}
        />
      ))
    );

  return (
    <svg width={size} height={size} viewBox={`0 0 ${vbSize} ${vbSize}`} fill="none">
      <g transform={`translate(${tx}, ${ty}) rotate(45, ${cx}, ${cy})`}>
        <g>
          {half('rgba(86,219,211,0.78)', 'rgba(86,219,211,0.14)')}
        </g>
        <g transform={`translate(${HALF_W + GAP}, ${SHIFT})`}>
          {half('rgba(167,139,250,0.78)', 'rgba(167,139,250,0.14)')}
        </g>
      </g>
    </svg>
  );
}
