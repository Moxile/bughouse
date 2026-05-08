export type PieceType = 'K' | 'Q' | 'R' | 'B' | 'N' | 'P';

export type PieceSet = {
  key: string;
  label: string;
  paths: Record<PieceType, (fill: string, stroke: string) => string>;
};

// ─── Cburnett ──────────────────────────────────────────────────────────────
// Classic detailed pieces, viewBox 0 0 45 45.

const cburnettPaths: PieceSet['paths'] = {
  K: (f, s) =>
    `<g fill="${f}" stroke="${s}" stroke-width="1.6" stroke-linejoin="round">` +
    `<path d="M22.5 11.6V6m-3 0h6" stroke-linecap="round"/>` +
    `<path d="M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5"/>` +
    `<path d="M11.5 37c5.5 3.5 15.5 3.5 21 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V27v-3.5c-3.5-7.5-13-10.5-16-4-3 6 5 10 5 10z"/>` +
    `<path d="M11.5 30c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0"/>` +
    `</g>`,

  Q: (f, s) =>
    `<g fill="${f}" stroke="${s}" stroke-width="1.6" stroke-linejoin="round">` +
    `<path d="M9 26c8.5-1.5 21-1.5 27 0l2-12-7 11V11l-5.5 13.5-3-15-3 15-5.5-14V25L7 14l2 12z"/>` +
    `<path d="M9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1.5 2.5-1.5 2.5-1.5 1.5.5 2.5.5 2.5 6.5 1 16.5 1 23 0 0 0 1.5-1 0-2.5 0 0 .5-1.5-1-2.5-.5-2.5-.5-2 .5-3.5 1-2 2.5-2 2.5-4-8.5-1.5-18.5-1.5-27 0z"/>` +
    `<circle cx="6" cy="12" r="2"/><circle cx="14" cy="9" r="2"/><circle cx="22.5" cy="8" r="2"/><circle cx="31" cy="9" r="2"/><circle cx="39" cy="12" r="2"/>` +
    `</g>`,

  R: (f, s) =>
    `<g fill="${f}" stroke="${s}" stroke-width="1.6" stroke-linejoin="round">` +
    `<path d="M9 39h27v-3H9v3zm3-3v-4h21v4H12zm-1-22V9h4v2h5V9h5v2h5V9h4v5"/>` +
    `<path d="M34 14l-3 3H14l-3-3"/>` +
    `<path d="M31 17v12.5H14V17"/>` +
    `<path d="M31 29.5l1.5 2.5h-19l1.5-2.5"/>` +
    `<path d="M11 14h23"/>` +
    `</g>`,

  B: (f, s) =>
    `<g fill="${f}" stroke="${s}" stroke-width="1.6" stroke-linejoin="round">` +
    `<g>` +
    `<path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.354.49-2.323.47-3-.5 1.354-1.94 3-2 3-2z"/>` +
    `<path d="M15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2z"/>` +
    `<circle cx="22.5" cy="8" r="2.5"/>` +
    `</g>` +
    `<path d="M17.5 26h10M15 30h15m-7.5-14.5v5M20 18h5" stroke-linecap="round"/>` +
    `</g>`,

  N: (f, s) =>
    `<g fill="${f}" stroke="${s}" stroke-width="1.6" stroke-linejoin="round">` +
    `<path d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21"/>` +
    `<path d="M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.042-.94 1.41-3.04 0-3-1 0 .19 1.23-1 2-1 0-4.003 1-4-4 0-2 6-12 6-12s1.89-1.9 2-3.5c-.73-.994-.5-2-.5-3 1-1 3 2.5 3 2.5h2s.78-1.992 2.5-3c1 0 1 3 1 3"/>` +
    `<path d="M9.5 25.5a.5.5 0 1 1-1 0 .5.5 0 1 1 1 0z" fill="${s}"/>` +
    `<path d="M14.933 15.75a.5 1.5 30 1 1-.866-.5.5 1.5 30 1 1 .866.5z" fill="${s}"/>` +
    `</g>`,

  P: (f, s) =>
    `<g fill="${f}" stroke="${s}" stroke-width="1.6" stroke-linejoin="round">` +
    `<path d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 13.47h23c0-7.92-4.41-12.41-7.41-13.47 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z"/>` +
    `</g>`,
};

// ─── Alpha ─────────────────────────────────────────────────────────────────
// Flat, clean, geometric pieces. Simple shapes, minimal interior detail.

const alphaPaths: PieceSet['paths'] = {
  K: (f, s) =>
    `<g fill="${f}" stroke="${s}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">` +
    `<path d="M22.5 7.5v9M18.5 12h8" stroke-width="2.2"/>` +
    `<path d="M14 22c0-5.5 3.5-8.5 8.5-8.5s8.5 3 8.5 8.5v11.5H14z"/>` +
    `<rect x="12" y="33.5" width="21" height="4" rx="1"/>` +
    `</g>`,

  Q: (f, s) =>
    `<g fill="${f}" stroke="${s}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">` +
    `<circle cx="6" cy="12" r="2.5"/><circle cx="14" cy="9" r="2.5"/>` +
    `<circle cx="22.5" cy="8" r="2.5"/><circle cx="31" cy="9" r="2.5"/>` +
    `<circle cx="39" cy="12" r="2.5"/>` +
    `<path d="M9 27l2-14 6 10 5.5-13.5 5.5 13.5 6-10 2 14z"/>` +
    `<rect x="9" y="27" width="27" height="3.5" rx="1"/>` +
    `<rect x="11" y="30.5" width="23" height="5.5" rx="1"/>` +
    `</g>`,

  R: (f, s) =>
    `<g fill="${f}" stroke="${s}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">` +
    `<path d="M9 8h6v5.5h5V8h5v5.5h5V8h6v7H9z"/>` +
    `<rect x="11" y="15" width="23" height="16" rx="1"/>` +
    `<rect x="9" y="31" width="27" height="5" rx="1"/>` +
    `</g>`,

  B: (f, s) =>
    `<g fill="${f}" stroke="${s}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">` +
    `<circle cx="22.5" cy="8" r="3.5"/>` +
    `<path d="M15 34V19l7.5-7 7.5 7v15z"/>` +
    `<rect x="13.5" y="34" width="19" height="3" rx="1"/>` +
    `<path d="M20 24h5"/>` +
    `</g>`,

  N: (f, s) =>
    `<g fill="${f}" stroke="${s}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">` +
    `<path d="M22 10c10.5 1 16.5 8 16 27H15c0-9 10-6.5 8-21"/>` +
    `<path d="M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.042-.94 1.41-3.04 0-3-1 0 .19 1.23-1 2-1 0-4.003 1-4-4 0-2 6-12 6-12s1.89-1.9 2-3.5c-.73-.994-.5-2-.5-3 1-1 3 2.5 3 2.5h2s.78-1.992 2.5-3c1 0 1 3 1 3"/>` +
    `<path d="M9.5 25.5a.5.5 0 1 1-1 0 .5.5 0 1 1 1 0z" fill="${s}"/>` +
    `<path d="M14.933 15.75a.5 1.5 30 1 1-.866-.5.5 1.5 30 1 1 .866.5z" fill="${s}"/>` +
    `</g>`,

  P: (f, s) =>
    `<g fill="${f}" stroke="${s}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">` +
    `<circle cx="22.5" cy="10" r="5.5"/>` +
    `<rect x="17.5" y="33" width="10" height="4" rx="1"/>` +
    `<path d="M19.5 33V22a3 3 0 0 1 6 0v11z"/>` +
    `</g>`,
};

// ─── Merida ────────────────────────────────────────────────────────────────
// Heavier classical tournament style. Bolder strokes, fuller shapes.

const meridaPaths: PieceSet['paths'] = {
  K: (f, s) =>
    `<g fill="${f}" stroke="${s}" stroke-width="2.1" stroke-linejoin="round">` +
    `<path d="M22.5 11V5.5m-3.5 0h7" stroke-linecap="round"/>` +
    `<path d="M22.5 25.5s5-8.5 3-11.5c0 0-1-3-3-3s-3 3-3 3c-2 3 3 11.5 3 11.5"/>` +
    `<path d="M11 37.5c5.5 3.5 16 3.5 22.5 0v-7.5s9.5-4.5 6-11C35 13 25 16 22.5 23.5V27v-3.5C20 16 10 13.5 6.5 19c-3.5 6.5 5.5 10.5 5.5 10.5v7.5z"/>` +
    `<path d="M11 30c6-3.5 17-3.5 22.5 0m-22.5 4c6-3.5 17-3.5 22.5 0"/>` +
    `</g>`,

  Q: (f, s) =>
    `<g fill="${f}" stroke="${s}" stroke-width="2.1" stroke-linejoin="round">` +
    `<path d="M9 26c8.5-1.5 21-1.5 27 0l2-12-7 11V11l-5.5 13.5-3-15-3 15-5.5-14V25L7 14z"/>` +
    `<path d="M9 26c0 2.5 1.5 2.5 2.5 4.5 1 1.5.5 1.5.5 3.5-1.5 1-2 2.5-2 2.5-1 1.5 1 3 1 3 6.5 1 16 1 23 0 0 0 2-1.5 1-3 0 0-.5-1.5-2-2.5-.5-2.5-.5-2 .5-3.5.5-2 2.5-2 2.5-4.5-8.5-1.5-18.5-1.5-27 0z"/>` +
    `<circle cx="6" cy="12" r="2.5"/><circle cx="14" cy="9" r="2.5"/>` +
    `<circle cx="22.5" cy="8" r="2.5"/><circle cx="31" cy="9" r="2.5"/>` +
    `<circle cx="39" cy="12" r="2.5"/>` +
    `</g>`,

  R: (f, s) =>
    `<g fill="${f}" stroke="${s}" stroke-width="2.1" stroke-linejoin="round">` +
    `<path d="M9 39h27v-3H9v3zm3-3v-4h21v4H12zm-1-22V9h4v2h5V9h5v2h5V9h4v5"/>` +
    `<path d="M34 14l-3 3H14l-3-3"/>` +
    `<path d="M31 17v12.5H14V17"/>` +
    `<path d="M31 29.5l1.5 2.5h-19l1.5-2.5"/>` +
    `<path d="M11 14h23"/>` +
    `</g>`,

  B: (f, s) =>
    `<g fill="${f}" stroke="${s}" stroke-width="2.1" stroke-linejoin="round">` +
    `<g>` +
    `<path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.354.49-2.323.47-3-.5 1.354-1.94 3-2 3-2z"/>` +
    `<path d="M15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2z"/>` +
    `<circle cx="22.5" cy="8" r="2.5"/>` +
    `</g>` +
    `<path d="M17.5 26h10M15 30h15m-7.5-14.5v5M20 18h5" stroke-linecap="round"/>` +
    `</g>`,

  N: (f, s) =>
    `<g fill="${f}" stroke="${s}" stroke-width="2.1" stroke-linejoin="round">` +
    `<path d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21"/>` +
    `<path d="M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.042-.94 1.41-3.04 0-3-1 0 .19 1.23-1 2-1 0-4.003 1-4-4 0-2 6-12 6-12s1.89-1.9 2-3.5c-.73-.994-.5-2-.5-3 1-1 3 2.5 3 2.5h2s.78-1.992 2.5-3c1 0 1 3 1 3"/>` +
    `<path d="M9.5 25.5a.5.5 0 1 1-1 0 .5.5 0 1 1 1 0z" fill="${s}"/>` +
    `<path d="M14.933 15.75a.5 1.5 30 1 1-.866-.5.5 1.5 30 1 1 .866.5z" fill="${s}"/>` +
    `</g>`,

  P: (f, s) =>
    `<g fill="${f}" stroke="${s}" stroke-width="2.1" stroke-linejoin="round">` +
    `<path d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 13.47h23c0-7.92-4.41-12.41-7.41-13.47 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z"/>` +
    `</g>`,
};

export const PIECE_SETS: PieceSet[] = [
  { key: 'cburnett', label: 'Cburnett', paths: cburnettPaths },
  { key: 'alpha',    label: 'Alpha',    paths: alphaPaths    },
  { key: 'merida',   label: 'Merida',   paths: meridaPaths   },
];

export const DEFAULT_PIECE_SET = PIECE_SETS[0]!;

export function loadPieceSet(): PieceSet {
  try {
    const key = localStorage.getItem('pieceSet');
    return PIECE_SETS.find((s) => s.key === key) ?? DEFAULT_PIECE_SET;
  } catch {
    return DEFAULT_PIECE_SET;
  }
}

export function savePieceSet(set: PieceSet): void {
  try { localStorage.setItem('pieceSet', set.key); } catch {}
}
