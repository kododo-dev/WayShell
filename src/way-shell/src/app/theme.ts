import { createTheme, type Theme, type ThemeOptions } from '@mui/material';
import type { WayOptions } from '../contract.js';

export type ThemeMode = 'light' | 'dark';

const THEME_KEY = 'way-shell:theme';

/** The mode the user chose last, on any Way of this origin, else the system's. */
export function initialThemeMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // storage blocked
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function rememberThemeMode(mode: ThemeMode) {
  try {
    localStorage.setItem(THEME_KEY, mode);
  } catch {
    // not remembered, still switched
  }
}

/** The shell's theme options: MUI defaults on the neutral greys of the Way libraries. */
function shellThemeOptions(mode: ThemeMode): ThemeOptions {
  return {
    palette: {
      mode,
      background: mode === 'dark' ? { default: '#1a1a1a', paper: '#222' } : { default: '#f5f5f5', paper: '#fff' },
      divider: mode === 'dark' ? '#2e2e2e' : '#e0e0e0',
    },
  };
}

export function shellTheme(mode: ThemeMode): Theme {
  return createTheme(shellThemeOptions(mode));
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Plain objects merged key by key; anything else from `overrides` wins. */
function merge(base: Record<string, unknown>, overrides: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(overrides))
    result[key] = isObject(value) && isObject(result[key]) ? merge(result[key], value) : value;
  return result;
}

/**
 * The shell's theme with a Way's overrides, while that Way is shown. Built from the merged options, not on top of the
 * built theme: there typography variants already carry the shell's font, so a Way's font would not reach them.
 */
export function wayTheme(mode: ThemeMode, overrides: WayOptions['theme']): Theme | null {
  if (!overrides) return null;
  const options = typeof overrides === 'function' ? overrides(mode) : overrides;
  return createTheme(merge(shellThemeOptions(mode) as Record<string, unknown>, options as Record<string, unknown>) as ThemeOptions);
}
