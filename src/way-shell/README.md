# @kododo-dev/way-shell

Module contract, runtime and Vite preset for the UI of [Kododo](https://github.com/kododo-dev) Way libraries running inside **Way.Shell** ([Kododo.Way.Shell](https://www.nuget.org/packages/Kododo.Way.Shell) on NuGet).

> **Status:** in development, not released yet. The contract is version 2, the major version of the Way family it ships with; it may still change before 2.0.0.

A Way's UI is a React module that the shell loads into one page with one copy of React, MUI, emotion and React Router, shared through an import map. The shell provides the layout (side menu with the Ways, the host's links and the user), the theme, the language and the API client. This package is what the module is written and built against.

## Writing a module

```tsx
// src/way.tsx
import { Button } from '@mui/material';
import { Route, Routes } from 'react-router-dom';
import { PageHeader, WayMenu, defineWay, useI18n, useShell } from '@kododo-dev/way-shell';

function Home() {
  const { api, user } = useShell();
  const { t } = useI18n();
  return (
    <>
      <PageHeader title={t('title')}>
        <Button onClick={() => api.post('Save', { name: user?.name })}>{t('save')}</Button>
      </PageHeader>
      {/* the page */}
    </>
  );
}

export default defineWay({
  App: () => (
    <>
      <WayMenu>{/* the Way's own items in the shell's side menu */}</WayMenu>
      <Routes>
        <Route index element={<Home />} />
      </Routes>
    </>
  ),
  translations: { en: { title: 'Settings', save: 'Save' }, pl: { title: 'Ustawienia', save: 'Zapisz' } },
  // theme: (mode) => ({ typography: { fontFamily: 'monospace' } }),
});
```

- `useShell()` (and the `App` props): `wayId`, `apiBase`, `api`, `user`, `language`, `themeMode`, `settings` and `navigate(wayId, path)`.
- Links to other Ways: `ways` lists every Way in the app the user may open; `navigate(wayId, path)` goes to one, inside the panel when the page is the panel and to the Way's own page otherwise; `href(wayId, path)` gives the same URL for an `<a>`, or `null` when the user may not open that Way. Show the link only when it is not `null`:

  ```tsx
  const { href } = useShell();
  const trace = href('traces', `trace/${traceId}`); // TraceWay, when the app has it and the user may open it
  return trace ? <Link href={trace}>{traceId}</Link> : <span>{traceId}</span>;
  ```

  `path` is a route of the target Way, so a Way that others link to documents its routes and keeps them stable.
- `api.post(request, body)` calls `POST {apiBase}/{request}` (Reiho requests). It throws `ApiError` (problem details, with `messages` and field `errors`), `ForbiddenError` or `SessionExpiredError`; an expired session also opens the shell's dialog that lets the user sign in again in a new tab.
- `useI18n()`: `t(key, values?)` from the Way's `translations` in the language the shell shows, then English; `language` and `setLanguage`.
- `PageHeader`: the header bar of a page, with the menu button on narrow screens. `WayMenu`: items rendered into the shell's side menu.
- The shell owns the router (hash routing), so the module renders `<Routes>` with paths relative to its root.

## Building it

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { wayModule } from '@kododo-dev/way-shell/vite';

export default defineConfig({
  plugins: [react(), wayModule()],
  server: { proxy: { '/config/api': 'http://localhost:5000' } }, // for npm run dev
});
```

`vite build` writes `dist/way.js` and `dist/way.css`, which the Way's `.csproj` embeds. The preset:

- leaves the shared libraries (`react`, `react-dom`, `react-dom/client`, `react/jsx-runtime`, `@emotion/react`, `@emotion/styled`, `@mui/material`, `@mui/system`, `react-router-dom`, `@kododo-dev/way-shell`) as imports for the shell's import map;
- rewrites deep imports such as `@mui/material/Button`, `@mui/material/useMediaQuery` or `@mui/system/createStyled` (as `@mui/icons-material`, MUI X and Lab make them) to the package root, keeping their default exports, and `react-router` to `react-router-dom`;
- replaces `use-sync-external-store` (CommonJS around `require('react')`, used by MUI X, react-redux, Zustand) with an ES module on the shared React;
- fails the build when anything would still bundle a second copy of a shared library (for example `@emotion/cache` or `@mui/styled-engine`), or when a CommonJS dependency `require()`s one, instead of failing in the browser;
- records the contract version the module was built for, so the shell can refuse a module built for another major version.

Icons (`@mui/icons-material`) and other stateless libraries are bundled into the module, so only the icons it uses are included.

What the module loads with `import()` (`React.lazy`, a chart library, a flag per language) goes to content-named files in `dist/chunks/`, embedded and served next to `way.js`, and is fetched only when needed. The preset warns when `way.js` itself is over 100 KB after gzip, since every page of the Way waits for it; `wayModule({ sizeWarningKb: 200 })` moves the limit and `false` turns the warning off.

## Working on it locally

`npm run dev` with an `index.html` rendering the module inside `WayDevHost`: the same shell as in the app, with Vite's hot reload, and the API through Vite's proxy to the running backend.

```tsx
// src/main.tsx
import { createRoot } from 'react-dom/client';
import { WayDevHost } from '@kododo-dev/way-shell';
import way from './way';

createRoot(document.getElementById('root')!).render(<WayDevHost way={way} id="config" apiBase="/config/api" user={{ name: 'dev' }} />);
```

## License

MIT
