import type { ComponentType } from 'react';
import type { ThemeOptions } from '@mui/material/styles';
import type { WayApi } from './api.js';

/**
 * Version of the contract between the shell and Way modules. It is the major version of Way.Shell: the shell
 * refuses a module built for another one. Kododo.Way.Shell (NuGet) carries the same number.
 */
export const CONTRACT = 2;

/** The signed-in user as the host describes it. */
export interface ShellUser {
  name: string;
  /** Page of the user's account the name links to; no link when missing. */
  accountUrl?: string | null;
  /** Where the shell's sign-out button posts to; no button when missing. */
  signOutUrl?: string | null;
}

/** A Way the current user may open, as {@link WayProps.ways} lists it. */
export interface ShellWay {
  id: string;
  name: string;
}

/** What the shell hands to a Way module, as props and through {@link useShell}. */
export interface WayProps {
  /** Id of this Way, as registered by its `Use*Way` call. */
  wayId: string;
  /** Base URL of the Way's API, including the app's path base, without a trailing slash. */
  apiBase: string;
  user: ShellUser | null;
  /** Language the shell resolved (user, host, browser), e.g. `en` or `pl`. */
  language: string;
  themeMode: 'light' | 'dark';
  /** Settings the Way's backend adds to the shell settings, as JSON. */
  settings: Record<string, unknown>;
  /** Client of the Way's API at {@link apiBase}, with the shell's handling of an expired session. */
  api: WayApi;
  /**
   * Every Way in the app the current user may open, this one included, in the order they were mounted. Check it
   * before showing a link to another Way, e.g. LogWay's link from a trace id to TraceWay.
   */
  ways: readonly ShellWay[];
  /**
   * Navigates within this Way or to another one: inside the panel when the page is the panel, otherwise to the
   * other Way's own page. `path` is relative to that Way's root, e.g. `navigate(wayId, 'section/smtp')`; use it
   * rather than relative router links outside the module's own `<Routes>`, which resolve against the whole current
   * path in the shell's splat route. Does nothing for a Way that is not in {@link ways}.
   */
  navigate(wayId: string, path?: string, options?: { replace?: boolean }): void;
  /**
   * The URL {@link navigate} goes to, for a link (`<a href>`) that can also be opened in a new tab or copied;
   * `null` for a Way that is not in {@link ways}.
   */
  href(wayId: string, path?: string): string | null;
}

/** Strings of a Way per language: `{ en: { 'save': 'Save' }, pl: { 'save': 'Zapisz' } }`. */
export type WayTranslations = Record<string, Record<string, string>>;

/** What a Way module declares with {@link defineWay}. */
export interface WayOptions {
  /** Root component, rendered inside the shell's router, theme and error boundary. */
  App: ComponentType<WayProps>;
  translations?: WayTranslations;
  /**
   * Overrides on top of the shell's theme while this Way is shown, e.g. a dense layout or a monospace font. A
   * function gets the shell's theme mode.
   */
  theme?: ThemeOptions | ((mode: 'light' | 'dark') => ThemeOptions);
}

/** A built Way module's default export: the options plus the contract it was built for. */
export interface WayDefinition extends WayOptions {
  contract: number;
}

/**
 * Declares a Way module; its result is the module's default export. The contract version is added when the
 * module is built with the `wayModule()` Vite preset, so it records the version the module was built against.
 */
export function defineWay(options: WayOptions): WayOptions {
  return options;
}
