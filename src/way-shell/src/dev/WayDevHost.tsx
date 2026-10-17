import { useMemo } from 'react';
import { CONTRACT, type WayOptions } from '../contract.js';
import { ShellApp } from '../app/ShellApp.js';
import type { ShellLink } from '../app/settings.js';
import type { ShellUser } from '../contract.js';

export interface WayDevHostProps {
  /** The module's default export, `defineWay(...)`. */
  way: WayOptions;
  /** Default: `dev`. */
  id?: string;
  /** Default: the id. */
  name?: string;
  /** Where the Way's API is, e.g. `/config/api` with Vite's proxy to the backend. Default: `/api`. */
  apiBase?: string;
  title?: string;
  user?: ShellUser | null;
  language?: string | null;
  links?: ShellLink[];
  settings?: Record<string, unknown>;
}

/**
 * The shell around a Way's module for `npm run dev`: same layout, theme, language and API client as in the app, with
 * the module and the shared libraries bundled by Vite as usual. In `src/main.tsx` of the Way's UI:
 *
 * ```tsx
 * createRoot(document.getElementById('root')!).render(<WayDevHost way={way} apiBase="/config/api" />);
 * ```
 */
export function WayDevHost({ way, id = 'dev', name, apiBase = '/api', title, user = null, language = null, links = [], settings = {} }: WayDevHostProps) {
  const shellSettings = useMemo(
    () => ({
      title: title ?? name ?? id,
      homeUrl: null,
      language,
      links,
      user,
      mode: 'single' as const,
      wayId: id,
      ways: [{
        id,
        name: name ?? id,
        icon: null,
        url: window.location.pathname,
        apiBase,
        moduleUrl: '',
        cssUrl: null,
        settings,
        definition: { ...way, contract: CONTRACT },
      }],
    }),
    [way, id, name, apiBase, title, user, language, links, settings],
  );
  return <ShellApp settings={shellSettings} />;
}
