/**
 * ES module stand-in for the use-sync-external-store package (MUI X, react-redux, Zustand and others use it). The
 * package is CommonJS and require()s 'react', which a Way module takes from the shell's import map, so the require
 * cannot work there. React 19 has useSyncExternalStore built in; useSyncExternalStoreWithSelector is ported from
 * React's use-sync-external-store/with-selector (MIT, Meta Platforms, Inc. and affiliates).
 */
export const USE_SYNC_EXTERNAL_STORE = `
import { useDebugValue, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';

export { useSyncExternalStore };

export function useSyncExternalStoreWithSelector(subscribe, getSnapshot, getServerSnapshot, selector, isEqual) {
  const instRef = useRef(null);
  let inst;
  if (instRef.current === null) {
    inst = { hasValue: false, value: null };
    instRef.current = inst;
  } else {
    inst = instRef.current;
  }

  const [getSelection, getServerSelection] = useMemo(() => {
    let hasMemo = false;
    let memoizedSnapshot;
    let memoizedSelection;
    const memoizedSelector = (nextSnapshot) => {
      if (!hasMemo) {
        hasMemo = true;
        memoizedSnapshot = nextSnapshot;
        const nextSelection = selector(nextSnapshot);
        if (isEqual !== undefined && inst.hasValue) {
          const currentSelection = inst.value;
          if (isEqual(currentSelection, nextSelection)) {
            memoizedSelection = currentSelection;
            return currentSelection;
          }
        }
        memoizedSelection = nextSelection;
        return nextSelection;
      }
      const prevSnapshot = memoizedSnapshot;
      const prevSelection = memoizedSelection;
      if (Object.is(prevSnapshot, nextSnapshot)) return prevSelection;
      const nextSelection = selector(nextSnapshot);
      if (isEqual !== undefined && isEqual(prevSelection, nextSelection)) {
        memoizedSnapshot = nextSnapshot;
        return prevSelection;
      }
      memoizedSnapshot = nextSnapshot;
      memoizedSelection = nextSelection;
      return nextSelection;
    };
    const serverSnapshot = getServerSnapshot ?? null;
    return [
      () => memoizedSelector(getSnapshot()),
      serverSnapshot === null ? undefined : () => memoizedSelector(serverSnapshot()),
    ];
  }, [getSnapshot, getServerSnapshot, selector, isEqual]);

  const value = useSyncExternalStore(subscribe, getSelection, getServerSelection);

  useEffect(() => {
    inst.hasValue = true;
    inst.value = value;
  }, [value]);

  useDebugValue(value);
  return value;
}

export default { useSyncExternalStore, useSyncExternalStoreWithSelector };
`;
