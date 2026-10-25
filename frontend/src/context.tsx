import { createContext, useContext } from 'react';
import type { Meta } from './types';
export interface Workspace {
  meta: Meta;
  refresh: () => void;
  currency: string;
  setCurrency: (value: string) => void;
  money: (value: number, compact?: boolean) => string;
  query: string;
  start: string;
  end: string;
  setStart: (value: string) => void;
  setEnd: (value: string) => void;
  country: string;
  setCountry: (value: string) => void;
  notify: (message: string, error?: boolean) => void;
}
export const WorkspaceContext = createContext<Workspace | null>(null);
export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error('Workspace unavailable');
  return value;
}
export const number = (value: number) => new Intl.NumberFormat('en-GB').format(value);
export const shortDate = (value: string) =>
  new Date(value.slice(0, 10) + 'T12:00:00').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
export const fullDate = (value: string) =>
  new Date(value.slice(0, 10) + 'T12:00:00').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
export const dayDate = (value: string) =>
  new Date(value.slice(0, 10) + 'T12:00:00').toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
export const monthDate = (value: string) =>
  new Date(value.slice(0, 7) + '-15T12:00:00').toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  });
export const dateRange = (start: string, end: string) => `${fullDate(start)} – ${fullDate(end)}`;
export const percent = (value: number, digits = 1) =>
  `${(Number.isFinite(value) ? value * 100 : 0).toFixed(digits)}%`;
