import { useState } from 'react';
import {
  Box, Divider, IconButton, Link, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Menu, MenuItem, Tooltip,
  Typography,
} from '@mui/material';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import LanguageIcon from '@mui/icons-material/Language';
import LogoutIcon from '@mui/icons-material/Logout';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import { useLocation, useNavigate } from 'react-router-dom';
import { SHELL_LANGUAGES, shellText } from '../i18n.js';
import { ArrowOutwardIcon, iconFor } from './icons.js';
import type { ShellSettings } from './settings.js';
import type { ThemeMode } from './theme.js';

const itemText = (active: boolean) => ({
  '& .MuiListItemText-primary': { fontSize: '0.85rem', fontWeight: active ? 600 : 400, color: active ? 'text.primary' : 'text.secondary' },
});

function Header({ settings, themeMode, onToggleTheme, language, onLanguage }: {
  settings: ShellSettings;
  themeMode: ThemeMode;
  onToggleTheme(): void;
  language: string;
  onLanguage(language: string): void;
}) {
  const [languageMenu, setLanguageMenu] = useState<HTMLElement | null>(null);
  const dark = themeMode === 'dark';
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 2.5, py: 2, borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
      <Typography sx={{ flex: 1, minWidth: 0, fontSize: '0.95rem', fontWeight: 700, letterSpacing: '0.02em' }} noWrap>
        {settings.homeUrl ? <Link href={settings.homeUrl} underline="none" color="inherit">{settings.title}</Link> : settings.title}
      </Typography>
      <Tooltip title={shellText(language, 'language')}>
        <IconButton size="small" aria-label={shellText(language, 'language')} onClick={(e) => setLanguageMenu(e.currentTarget)}>
          <LanguageIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Tooltip>
      <Menu anchorEl={languageMenu} open={!!languageMenu} onClose={() => setLanguageMenu(null)}>
        {Object.entries(SHELL_LANGUAGES).map(([code, name]) => (
          <MenuItem key={code} selected={code === language} onClick={() => { onLanguage(code); setLanguageMenu(null); }}>
            {name}
          </MenuItem>
        ))}
      </Menu>
      <Tooltip title={shellText(language, dark ? 'switchToLight' : 'switchToDark')}>
        <IconButton size="small" aria-label={shellText(language, dark ? 'switchToLight' : 'switchToDark')} onClick={onToggleTheme}>
          {dark ? <LightModeIcon sx={{ fontSize: 18 }} /> : <DarkModeIcon sx={{ fontSize: 18 }} />}
        </IconButton>
      </Tooltip>
    </Box>
  );
}

function WayList({ settings, onNavigate }: { settings: ShellSettings; onNavigate(): void }) {
  const navigate = useNavigate();
  const current = useLocation().pathname.split('/')[1];
  return (
    <List component="nav" dense sx={{ py: 1, flexShrink: 0 }}>
      {settings.ways.filter((w) => !w.hidden).map((w) => {
        const Icon = iconFor(w.icon);
        const active = w.id === current;
        return (
          <ListItem key={w.id} disablePadding>
            <ListItemButton selected={active} onClick={() => { navigate(`/${w.id}/`); onNavigate(); }}>
              <ListItemIcon sx={{ minWidth: 34, color: active ? 'primary.main' : 'text.disabled' }}><Icon sx={{ fontSize: 18 }} /></ListItemIcon>
              <ListItemText primary={w.name} sx={itemText(active)} />
            </ListItemButton>
          </ListItem>
        );
      })}
    </List>
  );
}

const trimSlash = (path: string) => path.replace(/\/+$/, '') || '/';

/** True when the link points at the page the shell is on. */
function isCurrent(url: string) {
  try {
    return trimSlash(new URL(url, document.baseURI).pathname) === trimSlash(window.location.pathname);
  } catch {
    return false;
  }
}

/** The host's links and the signed-in user at the bottom; nothing when the host set neither. */
function HostMenu({ settings, language }: { settings: ShellSettings; language: string }) {
  const { links, user } = settings;
  if (links.length === 0 && !user) return null;
  return (
    <Box sx={{ flexShrink: 0, borderTop: 1, borderColor: 'divider' }}>
      {links.length > 0 && (
        <List dense disablePadding sx={{ py: 1 }}>
          {links.map((link) => {
            const current = isCurrent(link.url);
            const Icon = iconFor(link.icon, ArrowOutwardIcon);
            return (
              <ListItem key={link.url} disablePadding>
                <ListItemButton component="a" href={link.url} selected={current} aria-current={current ? 'page' : undefined}>
                  <ListItemIcon sx={{ minWidth: 34, color: current ? 'primary.main' : 'text.disabled' }}><Icon sx={{ fontSize: 16 }} /></ListItemIcon>
                  <ListItemText primary={link.title} sx={itemText(current)} />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      )}
      {links.length > 0 && user && <Divider sx={{ mx: 2 }} />}
      {user && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2.5, py: 1.5 }}>
          <PersonOutlinedIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
          <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: '0.85rem' }} data-testid="shell-user">
            {user.accountUrl ? <Link href={user.accountUrl} underline="hover" color="inherit">{user.name}</Link> : user.name}
          </Typography>
          {user.signOutUrl && (
            // A form, not a link: signing out changes state, so it is a POST the host can protect against CSRF.
            <form method="post" action={user.signOutUrl} style={{ margin: 0 }}>
              <Tooltip title={shellText(language, 'signOut')}>
                <IconButton type="submit" size="small" aria-label={shellText(language, 'signOut')}>
                  <LogoutIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </form>
          )}
        </Box>
      )}
    </Box>
  );
}

/**
 * The side menu: title, language and theme, the Ways of the panel, the slot a Way's WayMenu renders into, and the
 * host's links and user.
 */
export function SideMenu(props: {
  settings: ShellSettings;
  themeMode: ThemeMode;
  onToggleTheme(): void;
  language: string;
  onLanguage(language: string): void;
  onNavigate(): void;
  menuSlotRef(element: HTMLElement | null): void;
}) {
  const { settings, language, onNavigate, menuSlotRef } = props;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Header {...props} />
      {settings.mode === 'panel' && <WayList settings={settings} onNavigate={onNavigate} />}
      {settings.mode === 'panel' && <Divider sx={{ mx: 2 }} />}
      <Box ref={menuSlotRef} sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }} data-testid="way-menu" />
      <HostMenu settings={settings} language={language} />
    </Box>
  );
}
