import { createContext, useCallback, useContext, useMemo } from 'react';
import type { WayTranslations } from './contract.js';

/** The shell's own strings; a Way's strings come from its `translations`. */
const shellStrings = {
  en: {
    language: 'Language',
    switchToLight: 'Switch to light theme',
    switchToDark: 'Switch to dark theme',
    openMenu: 'Open menu',
    signOut: 'Sign out',
    sessionExpiredTitle: 'Session expired',
    sessionExpiredBody: 'Sign in again in a new tab, then come back here: what you have not saved yet stays on this page.',
    signInAgain: 'Sign in again',
    continue: 'Continue',
    wayFailed: '{name} stopped working: {message}',
    reload: 'Reload',
    notBuiltWithPreset: '{name} was not built with the wayModule() preset of @kododo-dev/way-shell.',
    otherContract: '{name} was built for version {contract} of Way.Shell; this shell is version {shell}.',
    updatePackages: 'Update the Way and Way.Shell packages to the same major version.',
    notAvailable: 'There is no “{id}” here, or you cannot open it.',
    nothingToOpen: 'There is nothing here you can open.',
    loading: 'Loading…',
  },
  pl: {
    language: 'Język',
    switchToLight: 'Jasny motyw',
    switchToDark: 'Ciemny motyw',
    openMenu: 'Otwórz menu',
    signOut: 'Wyloguj',
    sessionExpiredTitle: 'Sesja wygasła',
    sessionExpiredBody: 'Zaloguj się ponownie w nowej karcie i wróć tutaj: niezapisane zmiany zostają na tej stronie.',
    signInAgain: 'Zaloguj ponownie',
    continue: 'Kontynuuj',
    wayFailed: '{name} przestał działać: {message}',
    reload: 'Odśwież',
    notBuiltWithPreset: '{name} nie został zbudowany presetem wayModule() z @kododo-dev/way-shell.',
    otherContract: '{name} zbudowano dla wersji {contract} Way.Shell, a ta powłoka ma wersję {shell}.',
    updatePackages: 'Zaktualizuj paczki Way i Way.Shell do tej samej wersji głównej.',
    notAvailable: 'Nie ma tu „{id}” albo nie masz do tego dostępu.',
    nothingToOpen: 'Nie ma tu nic, co możesz otworzyć.',
    loading: 'Wczytywanie…',
  },
} as const;

export type ShellStringKey = keyof (typeof shellStrings)['en'];

/** Languages the shell offers, with their own names. */
export const SHELL_LANGUAGES: Record<string, string> = { en: 'English', pl: 'Polski' };

/** Picks the first supported language: the user's choice, the host's, then the browser's; English otherwise. */
export function resolveLanguage(...candidates: (string | null | undefined)[]): string {
  const browser = typeof navigator === 'undefined' ? [] : navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const tag of [...candidates, ...browser]) {
    const code = tag?.split('-')[0].toLowerCase();
    if (code && code in SHELL_LANGUAGES) return code;
  }
  return 'en';
}

/** Replaces `{name}` placeholders with values. */
export function format(text: string, values?: Record<string, string | number>): string {
  return values ? text.replace(/\{(\w+)\}/g, (match, name: string) => (name in values ? String(values[name]) : match)) : text;
}

export function shellText(language: string, key: ShellStringKey, values?: Record<string, string | number>): string {
  const strings = (shellStrings as Record<string, Record<ShellStringKey, string>>)[language] ?? shellStrings.en;
  return format(strings[key], values);
}

interface I18nState {
  language: string;
  setLanguage(language: string): void;
  translations: WayTranslations;
}

/** Provided by the shell around each Way, with that Way's translations. */
export const I18nContext = createContext<I18nState>({ language: 'en', setLanguage: () => {}, translations: {} });

export interface I18n {
  /** The language the shell shows, e.g. `en`. */
  language: string;
  /** Languages the user can switch to, with their own names. */
  languages: Record<string, string>;
  setLanguage(language: string): void;
  /**
   * The Way's string for `key` in the current language, then in English, then `fallback` or the key itself.
   * `{name}` placeholders are replaced with `values`.
   */
  t(key: string, values?: Record<string, string | number>, fallback?: string): string;
}

/** Strings of the current Way in the language the shell shows. */
export function useI18n(): I18n {
  const { language, setLanguage, translations } = useContext(I18nContext);
  const t = useCallback(
    (key: string, values?: Record<string, string | number>, fallback?: string) =>
      format(translations[language]?.[key] ?? translations.en?.[key] ?? fallback ?? key, values),
    [language, translations],
  );
  return useMemo(() => ({ language, languages: SHELL_LANGUAGES, setLanguage, t }), [language, setLanguage, t]);
}
