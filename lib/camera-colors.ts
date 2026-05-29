export type CameraColor = 'red' | 'amber' | 'green' | 'gray' | 'blue' | 'purple' | 'pink' | 'orange' | 'teal' | 'indigo';

export const PALETTE: CameraColor[] = ['red', 'amber', 'green', 'gray', 'blue', 'purple', 'pink', 'orange', 'teal', 'indigo'];

export const COLOR_MAP: Record<CameraColor, {
  dot: string; pieno: string; leggero: string; bar: string;
  bg: string; border: string; testo: string;
  hex: string; hexLight: string; hexArea: string;
}> = {
  red:    { dot: 'bg-red-500',    pieno: 'bg-red-500 text-white',     leggero: 'bg-red-100 text-red-600',     bar: 'bg-red-500',    bg: 'bg-red-100',    border: 'border-red-300',    testo: 'text-red-800',    hex: '#ef4444', hexLight: '#fee2e2', hexArea: '#f87171' },
  amber:  { dot: 'bg-amber-400',  pieno: 'bg-amber-400 text-white',   leggero: 'bg-amber-100 text-amber-600', bar: 'bg-amber-400',  bg: 'bg-amber-100',  border: 'border-amber-300',  testo: 'text-amber-800',  hex: '#f59e0b', hexLight: '#fef3c7', hexArea: '#fbbf24' },
  green:  { dot: 'bg-green-500',  pieno: 'bg-green-500 text-white',   leggero: 'bg-green-100 text-green-600', bar: 'bg-green-500',  bg: 'bg-green-100',  border: 'border-green-300',  testo: 'text-green-800',  hex: '#16a34a', hexLight: '#dcfce7', hexArea: '#4ade80' },
  gray:   { dot: 'bg-gray-400',   pieno: 'bg-gray-400 text-white',    leggero: 'bg-gray-100 text-gray-600',   bar: 'bg-gray-400',   bg: 'bg-gray-100',   border: 'border-gray-300',   testo: 'text-gray-800',   hex: '#6b7280', hexLight: '#f3f4f6', hexArea: '#9ca3af' },
  blue:   { dot: 'bg-blue-600',   pieno: 'bg-blue-600 text-white',    leggero: 'bg-blue-100 text-blue-600',   bar: 'bg-blue-600',   bg: 'bg-blue-100',   border: 'border-blue-300',   testo: 'text-blue-800',   hex: '#2563eb', hexLight: '#dbeafe', hexArea: '#60a5fa' },
  purple: { dot: 'bg-purple-500', pieno: 'bg-purple-500 text-white',  leggero: 'bg-purple-100 text-purple-600', bar: 'bg-purple-500', bg: 'bg-purple-100', border: 'border-purple-300', testo: 'text-purple-800', hex: '#8b5cf6', hexLight: '#ede9fe', hexArea: '#a78bfa' },
  pink:   { dot: 'bg-pink-500',   pieno: 'bg-pink-500 text-white',    leggero: 'bg-pink-100 text-pink-600',   bar: 'bg-pink-500',   bg: 'bg-pink-100',   border: 'border-pink-300',   testo: 'text-pink-800',   hex: '#ec4899', hexLight: '#fce7f3', hexArea: '#f472b6' },
  orange: { dot: 'bg-orange-500', pieno: 'bg-orange-500 text-white',  leggero: 'bg-orange-100 text-orange-600', bar: 'bg-orange-500', bg: 'bg-orange-100', border: 'border-orange-300', testo: 'text-orange-800', hex: '#f97316', hexLight: '#ffedd5', hexArea: '#fb923c' },
  teal:   { dot: 'bg-teal-500',   pieno: 'bg-teal-500 text-white',    leggero: 'bg-teal-100 text-teal-600',   bar: 'bg-teal-500',   bg: 'bg-teal-100',   border: 'border-teal-300',   testo: 'text-teal-800',   hex: '#14b8a6', hexLight: '#ccfbf1', hexArea: '#2dd4bf' },
  indigo: { dot: 'bg-indigo-500', pieno: 'bg-indigo-500 text-white',  leggero: 'bg-indigo-100 text-indigo-600', bar: 'bg-indigo-500', bg: 'bg-indigo-100', border: 'border-indigo-300', testo: 'text-indigo-800', hex: '#6366f1', hexLight: '#e0e7ff', hexArea: '#818cf8' },
};

export const DEFAULT_COLOR_BY_ID: Record<number, CameraColor> = {
  1: 'red', 2: 'amber', 3: 'green', 4: 'gray', 5: 'blue',
  6: 'purple', 7: 'pink', 8: 'orange', 9: 'teal', 10: 'indigo',
};

export function getCameraStyle(cameraId: number, colore?: string) {
  const name = (colore as CameraColor | undefined) ?? DEFAULT_COLOR_BY_ID[cameraId] ?? 'gray';
  return COLOR_MAP[name] ?? COLOR_MAP.gray;
}
