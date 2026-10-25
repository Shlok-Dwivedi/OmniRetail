import { useSyncExternalStore } from 'react';

// Colours for chart marks (blue matches --blue in styles.css). Light uses Apple's system colours;
// dark steps the same hues into a lightness band that keeps every adjacent pair distinguishable
// for protanopes and deuteranopes on the #1c1c1e card surface.
export interface Palette {
  blue: string;
  orange: string;
  green: string;
  mint: string;
  red: string;
  gray: string;
  grid: string;
  axis: string;
  label: string;
  surface: string;
}

const light: Palette = {
  blue: '#007aff',
  orange: '#ff9500',
  green: '#34c759',
  mint: '#00c7be',
  red: '#ff3b30',
  gray: '#8e8e93',
  grid: '#e5e5ea',
  axis: '#6e6e73',
  label: '#1d1d1f',
  surface: '#ffffff',
};

const dark: Palette = {
  blue: '#0a84ff',
  orange: '#d08004',
  green: '#00a93d',
  mint: '#06a19e',
  red: '#d5040d',
  gray: '#8e8e93',
  grid: '#38383a',
  axis: '#98989f',
  label: '#f5f5f7',
  surface: '#1c1c1e',
};

const subscriptions = new Map<string, (notify: () => void) => () => void>();
function subscribe(query: string) {
  if (!subscriptions.has(query))
    subscriptions.set(query, (notify) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', notify);
      return () => list.removeEventListener('change', notify);
    });
  return subscriptions.get(query)!;
}

export function useMedia(query: string) {
  return useSyncExternalStore(
    subscribe(query),
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export const usePalette = () => (useMedia('(prefers-color-scheme: dark)') ? dark : light);
export const useReducedMotion = () => useMedia('(prefers-reduced-motion: reduce)');

// Segments read from strongest to weakest relationship; colour follows the segment, never its rank.
export const SEGMENT_ORDER = [
  'Champions',
  'Loyal Customers',
  'Potential Loyalists',
  'Need Attention',
  'At Risk',
  'Hibernating',
];
const segmentHue: Record<string, keyof Palette> = {
  Champions: 'green',
  'Loyal Customers': 'blue',
  'Potential Loyalists': 'mint',
  'Need Attention': 'orange',
  'At Risk': 'red',
  Hibernating: 'gray',
};
export const segmentColor = (palette: Palette, segment: string) =>
  palette[segmentHue[segment] ?? 'gray'];
export function bySegment<T extends { segment: string }>(items: T[]) {
  const rank = (s: string) => (SEGMENT_ORDER.includes(s) ? SEGMENT_ORDER.indexOf(s) : 99);
  return [...items].sort((a, b) => rank(a.segment) - rank(b.segment));
}
