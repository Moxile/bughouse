export type ColorScheme = {
  key: string;
  label: string;
  light: string;
  dark: string;
  selected: string;
  lastMove: string;
  legal: string;
};

export const COLOR_SCHEMES: ColorScheme[] = [
  {
    key: 'walnut',
    label: 'Walnut',
    light: '#e8d6b4', dark: '#7a5a3a',
    selected: 'rgba(86,219,211,0.45)',
    lastMove: 'rgba(255,213,79,0.35)',
    legal:    'rgba(86,219,211,0.40)',
  },
  {
    key: 'ice',
    label: 'Ice',
    light: '#dfe8ee', dark: '#3d5a73',
    selected: 'rgba(86,219,211,0.50)',
    lastMove: 'rgba(255,213,79,0.32)',
    legal:    'rgba(86,219,211,0.40)',
  },
  {
    key: 'graphite',
    label: 'Graphite',
    light: '#9aa0a6', dark: '#2c2f33',
    selected: 'rgba(86,219,211,0.55)',
    lastMove: 'rgba(255,213,79,0.30)',
    legal:    'rgba(86,219,211,0.45)',
  },
  {
    key: 'emerald',
    label: 'Emerald',
    light: '#e9e7d3', dark: '#3a6e58',
    selected: 'rgba(86,219,211,0.50)',
    lastMove: 'rgba(255,213,79,0.32)',
    legal:    'rgba(86,219,211,0.40)',
  },
  {
    key: 'neon',
    label: 'Neon',
    light: '#1f2933', dark: '#0a0e14',
    selected: 'rgba(86,219,211,0.55)',
    lastMove: 'rgba(255,213,79,0.25)',
    legal:    'rgba(86,219,211,0.45)',
  },
];

export const DEFAULT_SCHEME = COLOR_SCHEMES[0]!;

export function loadScheme(): ColorScheme {
  try {
    const key = localStorage.getItem('boardTheme');
    return COLOR_SCHEMES.find((s) => s.key === key) ?? DEFAULT_SCHEME;
  } catch {
    return DEFAULT_SCHEME;
  }
}

export function saveScheme(scheme: ColorScheme): void {
  try { localStorage.setItem('boardTheme', scheme.key); } catch {}
}
