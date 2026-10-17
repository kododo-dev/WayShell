import {
  Component, Suspense, createElement, use, useContext, useLayoutEffect, useMemo, useRef, type ComponentType, type ReactNode,
} from 'react';
import { Alert, Box, Button, CircularProgress, ThemeProvider } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { createApi } from '../api.js';
import { CONTRACT, type WayDefinition, type WayProps } from '../contract.js';
import { I18nContext, shellText } from '../i18n.js';
import { ShellContext } from '../shell.js';
import { wayTarget } from './navigation.js';
import type { ShellSettings, WayInfo } from './settings.js';
import { wayTheme, type ThemeMode } from './theme.js';

const modules = new Map<string, Promise<WayDefinition | Partial<WayDefinition> | undefined>>();

/** The Way's module, imported once per page; its CSS is added with it. */
function loadWay(way: WayInfo): Promise<WayDefinition | Partial<WayDefinition> | undefined> {
  // use() needs the same promise on every render, so even a module handed over directly is cached.
  let module = modules.get(way.id);
  if (!module && way.definition) {
    module = Promise.resolve(way.definition);
    modules.set(way.id, module);
  }
  if (!module) {
    if (way.cssUrl) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = way.cssUrl;
      document.head.appendChild(link);
    }
    module = import(/* @vite-ignore */ way.moduleUrl).then((m: { default?: Partial<WayDefinition> }) => m.default);
    modules.set(way.id, module);
  }
  return module;
}

function Incompatible({ way, contract, language }: { way: WayInfo; contract: number | undefined; language: string }) {
  return (
    <Alert severity="warning" sx={{ m: 3 }}>
      {contract === undefined
        ? shellText(language, 'notBuiltWithPreset', { name: way.name })
        : shellText(language, 'otherContract', { name: way.name, contract, shell: CONTRACT })}{' '}
      {shellText(language, 'updatePackages')}
    </Alert>
  );
}

/** Renders the module once loaded, in the shell's theme with the Way's overrides and with its translations. */
function WayRoot({ way, props, setLanguage }: { way: WayInfo; props: WayProps; setLanguage(language: string): void }) {
  const definition = use(loadWay(way));
  const theme = useMemo(() => wayTheme(props.themeMode, definition?.theme), [props.themeMode, definition]);
  const i18n = useMemo(
    () => ({ language: props.language, setLanguage, translations: definition?.translations ?? {} }),
    [props.language, setLanguage, definition],
  );

  if (definition?.contract !== CONTRACT || !definition.App)
    return <Incompatible way={way} contract={definition?.contract} language={props.language} />;

  const app = <I18nContext.Provider value={i18n}>{createElement(definition.App as ComponentType<WayProps>, props)}</I18nContext.Provider>;
  return theme ? <ThemeProvider theme={theme}>{app}</ThemeProvider> : app;
}

class WayBoundary extends Component<{ name: string; language: string; children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    const { name, language } = this.props;
    return (
      <Alert
        severity="error"
        sx={{ m: 3 }}
        action={<Button color="inherit" size="small" onClick={() => window.location.reload()}>{shellText(language, 'reload')}</Button>}
      >
        {shellText(language, 'wayFailed', { name, message: this.state.error.message })}
      </Alert>
    );
  }
}

export function WayHost({ way, settings, themeMode }: { way: WayInfo; settings: ShellSettings; themeMode: ThemeMode }) {
  // useNavigate() gives a new function after every change of the address. The Way's props must not follow it: a new
  // api client on every navigation makes a module load its data again, losing what the user has not saved.
  const routerNavigate = useNavigate();
  const navigateRef = useRef(routerNavigate);
  useLayoutEffect(() => {
    navigateRef.current = routerNavigate;
  }, [routerNavigate]);
  const api = useMemo(() => createApi(way.apiBase), [way.apiBase]);
  const { language, setLanguage } = useContext(I18nContext);
  const props = useMemo<WayProps>(
    () => ({
      wayId: way.id,
      apiBase: way.apiBase,
      api,
      user: settings.user,
      language,
      themeMode,
      settings: way.settings,
      ways: settings.ways.map((w) => ({ id: w.id, name: w.name })),
      navigate: (wayId, path = '', options) => {
        const to = wayTarget(settings, way.id, wayId, path);
        if (!to) return;
        if ('route' in to) navigateRef.current(to.route, options);
        else if (options?.replace) window.location.replace(to.url);
        else window.location.assign(to.url);
      },
      href: (wayId, path = '') => {
        const to = wayTarget(settings, way.id, wayId, path);
        if (!to) return null;
        return 'route' in to ? `${window.location.pathname}${window.location.search}#${to.route}` : to.url;
      },
    }),
    [way, settings, language, themeMode, api],
  );

  return (
    <WayBoundary key={way.id} name={way.name} language={language}>
      <ShellContext.Provider value={props}>
        <Suspense
          fallback={
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }} aria-label={shellText(language, 'loading')}>
              <CircularProgress size={28} />
            </Box>
          }
        >
          <WayRoot way={way} props={props} setLanguage={setLanguage} />
        </Suspense>
      </ShellContext.Provider>
    </WayBoundary>
  );
}
