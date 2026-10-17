import type { ShellSettings } from './settings.js';

/**
 * Where `navigate(wayId, path)` of the Way `current` goes: a route of the page's own router (in the panel, or within
 * the Way's page), the page of another Way, or nowhere for a Way the user may not open.
 */
export function wayTarget(
  settings: Pick<ShellSettings, 'mode' | 'ways'>,
  current: string,
  wayId: string,
  path: string,
): { route: string } | { url: string } | null {
  const rest = path.replace(/^\/+/, '');
  if (settings.mode === 'panel') return settings.ways.some((w) => w.id === wayId) ? { route: `/${wayId}/${rest}` } : null;
  if (wayId === current) return { route: `/${rest}` };
  const other = settings.ways.find((w) => w.id === wayId);
  return other ? { url: `${other.url}#/${rest}` } : null;
}
