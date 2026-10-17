/**
 * Libraries the shell provides through its import map. A Way module imports them by these exact specifiers and
 * never bundles them: React needs one instance for hooks, emotion for the theme and style cache, the router for its
 * context and this package for the shell's context.
 */
export const SHARED_LIBRARIES = [
  'react',
  'react-dom',
  'react-dom/client',
  'react/jsx-runtime',
  '@emotion/react',
  '@emotion/styled',
  '@mui/material',
  // MUI X and Lab import from it; one copy keeps its theme and default props shared with @mui/material.
  '@mui/system',
  'react-router-dom',
  '@kododo-dev/way-shell',
] as const;

export type SharedLibrary = (typeof SHARED_LIBRARIES)[number];
