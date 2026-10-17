import { createContext, useContext } from 'react';
import type { WayProps } from './contract.js';

/**
 * Provided by the shell around each Way. At runtime the module imports this package through the shell's import map,
 * so the shell and every module share one context.
 */
export const ShellContext = createContext<WayProps | null>(null);

/** The shell's props for the current Way; throws outside of the shell. */
export function useShell(): WayProps {
  const shell = useContext(ShellContext);
  if (!shell) throw new Error('useShell() is used outside of Way.Shell. Render the Way through the shell or WayDevHost.');
  return shell;
}
