import type { ShellUser, WayDefinition } from '../contract.js';

/** A Way as the shell lists it; mirrors WayInfo in ShellPage.cs. */
export interface WayInfo {
  id: string;
  name: string;
  /** Name of a Material icon for the panel's menu, e.g. `Settings`. */
  icon: string | null;
  /** The Way's own page (single mode), with the app's path base. */
  url: string;
  apiBase: string;
  moduleUrl: string;
  cssUrl: string | null;
  settings: Record<string, unknown>;
  /** The module itself instead of `moduleUrl`, as WayDevHost passes it. */
  definition?: WayDefinition;
}

export interface ShellLink {
  title: string;
  url: string;
  /** Name of a Material icon, e.g. `Home`; an arrow when missing. */
  icon?: string | null;
}

/** Written into the page by the backend; mirrors ShellSettings in ShellPage.cs. */
export interface ShellSettings {
  title: string;
  homeUrl: string | null;
  language: string | null;
  links: ShellLink[];
  user: ShellUser | null;
  /** `single`: the page of one Way. `panel`: UseWayShell's page with every Way the user may open. */
  mode: 'single' | 'panel';
  /** The Way of the page in `single` mode; `null` in the panel. */
  wayId: string | null;
  /** In the panel the Ways it shows; on a Way's page that Way and the others the user may open, for links. */
  ways: WayInfo[];
}
