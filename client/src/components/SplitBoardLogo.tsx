import React from 'react';

interface Props {
  width?: number;
}

export function SplitBoardLogo({ width = 160 }: Props) {
  const SQUARE = 14;
  const COLS = 4;
  const ROWS = 8;
  const GAP = 10;
  const SHIFT = 14;
  const HALF_W = COLS * SQUARE; // 56
  const HALF_H = ROWS * SQUARE; // 112

  // Content bounding box before rotation
  const contentW = HALF_W + GAP + HALF_W; // 122
  const contentH = HALF_H + SHIFT;         // 126
  const cx = contentW / 2;                 // 61  — content centre x
  const cy = contentH / 2;                 // 63  — content centre y

  // After 45° rotation the bounding box becomes a square of side (W+H)·cos45
  const vbSize = Math.ceil((contentW + contentH) * Math.SQRT1_2) + 4; // ≈ 180

  // Translate so the content centre lands at the viewBox centre
  const tx = vbSize / 2 - cx;
  const ty = vbSize / 2 - cy;

  const squares = (lightColor: string, darkColor: string) =>
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
    <svg width={width} height={width} viewBox={`0 0 ${vbSize} ${vbSize}`} fill="none">
      <g transform={`translate(${tx}, ${ty}) rotate(45, ${cx}, ${cy})`}>
        {/* Left half — teal, upper-left of diamond */}
        <g>
          {squares('rgba(86,219,211,0.62)', 'rgba(86,219,211,0.10)')}
        </g>
        {/* Right half — purple, lower-right of diamond, shifted */}
        <g transform={`translate(${HALF_W + GAP}, ${SHIFT})`}>
          {squares('rgba(167,139,250,0.62)', 'rgba(167,139,250,0.10)')}
        </g>
      </g>
    </svg>
  );
}
