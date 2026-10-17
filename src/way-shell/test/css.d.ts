// Lets the fixtures import their CSS like a Way's module does; Vite handles the file.
declare module '*.css';
declare module 'use-sync-external-store/shim/with-selector' {
  export function useSyncExternalStoreWithSelector<S, T>(subscribe: (cb: () => void) => () => void, getSnapshot: () => S, getServerSnapshot: null | (() => S), selector: (s: S) => T, isEqual?: (a: T, b: T) => boolean): T;
}
