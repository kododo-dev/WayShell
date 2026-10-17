import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, AppBar, Box, CssBaseline, Drawer, IconButton, ThemeProvider, Toolbar, Typography, useMediaQuery,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import { HashRouter, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { I18nContext, resolveLanguage, shellText } from '../i18n.js';
import { LayoutContext } from '../layout.js';
import { SessionExpiredDialog } from './SessionExpiredDialog.js';
import type { ShellSettings } from './settings.js';
import { SideMenu } from './SideMenu.js';
import { initialThemeMode, rememberThemeMode, shellTheme, type ThemeMode } from './theme.js';
import { WayHost } from './WayHost.js';

const DRAWER_WIDTH = 248;
const LANGUAGE_KEY = 'way-shell:language';

function storedLanguage(): string | null {
  try {
    return localStorage.getItem(LANGUAGE_KEY);
  } catch {
    return null;
  }
}

function PanelWay({ settings, themeMode, language }: { settings: ShellSettings; themeMode: ThemeMode; language: string }) {
  const { wayId } = useParams();
  const way = settings.ways.find((w) => w.id === wayId);
  if (!way) return <Alert severity="info" sx={{ m: 3 }}>{shellText(language, 'notAvailable', { id: wayId ?? '' })}</Alert>;
  return <WayHost way={way} settings={settings} themeMode={themeMode} />;
}

/** The Way of a `single` page; pages written before `wayId` existed list only that Way. */
function singleWay(settings: ShellSettings) {
  return settings.ways.find((w) => w.id === settings.wayId) ?? settings.ways[0];
}

/** Closes the menu on narrow screens after any navigation, also from a Way's own menu. */
function CloseMenuOnNavigate({ close }: { close(): void }) {
  const { pathname } = useLocation();
  useEffect(() => close(), [pathname, close]);
  return null;
}

/** The whole shell: theme, language, layout and router around the Ways of `settings`. */
export function ShellApp({ settings }: { settings: ShellSettings }) {
  const [themeMode, setThemeMode] = useState<ThemeMode>(initialThemeMode);
  const theme = useMemo(() => shellTheme(themeMode), [themeMode]);
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuSlot, setMenuSlot] = useState<HTMLElement | null>(null);
  const [headers, setHeaders] = useState(0);

  // The language picked in the shell wins, then the host's, then the browser's.
  const [chosenLanguage, setChosenLanguage] = useState<string | null>(storedLanguage);
  const language = resolveLanguage(chosenLanguage, settings.language);
  const setLanguage = useCallback((next: string) => {
    setChosenLanguage(next);
    try {
      localStorage.setItem(LANGUAGE_KEY, next);
    } catch {
      // not remembered, still switched
    }
  }, []);

  useEffect(() => {
    document.title = settings.title;
  }, [settings.title]);
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dataset.theme = themeMode;
  }, [language, themeMode]);

  const toggleTheme = () => {
    const next = themeMode === 'light' ? 'dark' : 'light';
    setThemeMode(next);
    rememberThemeMode(next);
  };

  const openMobileMenu = useCallback(() => setMobileOpen(true), []);
  const closeMobileMenu = useCallback(() => setMobileOpen(false), []);
  const registerHeader = useCallback(() => {
    setHeaders((n) => n + 1);
    return () => setHeaders((n) => n - 1);
  }, []);
  const layout = useMemo(
    () => ({ openMobileMenu, isMobile, menuSlot, registerHeader, language }),
    [openMobileMenu, isMobile, menuSlot, registerHeader, language],
  );
  const i18n = useMemo(() => ({ language, setLanguage, translations: {} }), [language, setLanguage]);

  const sideMenu = (
    <SideMenu
      settings={settings}
      themeMode={themeMode}
      onToggleTheme={toggleTheme}
      language={language}
      onLanguage={setLanguage}
      onNavigate={closeMobileMenu}
      menuSlotRef={setMenuSlot}
    />
  );
  const paper = { width: DRAWER_WIDTH, boxSizing: 'border-box' as const, bgcolor: 'background.paper' };
  const panel = settings.mode === 'panel';
  const home = settings.ways.find((w) => !w.hidden) ?? settings.ways[0];

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <I18nContext.Provider value={i18n}>
        <LayoutContext.Provider value={layout}>
          <HashRouter>
            <CloseMenuOnNavigate close={closeMobileMenu} />
            <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden', bgcolor: 'background.default' }}>
              {isMobile ? (
                <Drawer variant="temporary" open={mobileOpen} onClose={closeMobileMenu} ModalProps={{ keepMounted: true }} sx={{ '& .MuiDrawer-paper': paper }}>
                  {sideMenu}
                </Drawer>
              ) : (
                <Drawer variant="permanent" sx={{ width: DRAWER_WIDTH, flexShrink: 0, '& .MuiDrawer-paper': paper }}>
                  {sideMenu}
                </Drawer>
              )}
              <Box component="main" sx={{ flexGrow: 1, minWidth: 0, height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
                {isMobile && headers === 0 && (
                  // A Way without a PageHeader still needs a way to the menu on narrow screens.
                  <AppBar position="static" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
                    <Toolbar variant="dense">
                      <IconButton edge="start" onClick={openMobileMenu} aria-label={shellText(language, 'openMenu')}>
                        <MenuIcon />
                      </IconButton>
                      <Typography noWrap sx={{ fontWeight: 700 }}>{settings.title}</Typography>
                    </Toolbar>
                  </AppBar>
                )}
                {settings.notice && (
                  <Alert severity="info" variant="outlined" role="note" sx={{ m: 2, mb: 0, flexShrink: 0 }} data-testid="shell-notice">
                    {settings.notice}
                  </Alert>
                )}
                <Routes>
                  {panel ? (
                    <>
                      <Route path="/:wayId/*" element={<PanelWay settings={settings} themeMode={themeMode} language={language} />} />
                      <Route
                        path="*"
                        element={
                          home ? (
                            <Navigate to={`/${home.id}/`} replace />
                          ) : (
                            <Alert severity="info" sx={{ m: 3 }}>{shellText(language, 'nothingToOpen')}</Alert>
                          )
                        }
                      />
                    </>
                  ) : (
                    <Route path="/*" element={<WayHost way={singleWay(settings)} settings={settings} themeMode={themeMode} />} />
                  )}
                </Routes>
              </Box>
            </Box>
            <SessionExpiredDialog language={language} />
          </HashRouter>
        </LayoutContext.Provider>
      </I18nContext.Provider>
    </ThemeProvider>
  );
}
