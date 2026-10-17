import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Box, IconButton, Tooltip, Typography, useMediaQuery, useTheme } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import { shellText } from './i18n.js';

interface Layout {
  /** Opens the side menu on narrow screens. */
  openMobileMenu(): void;
  isMobile: boolean;
  /** Element of the side menu a Way's {@link WayMenu} renders into. */
  menuSlot: HTMLElement | null;
  /** A mounted PageHeader carries the menu button, so the shell hides its own bar on narrow screens. */
  registerHeader(): () => void;
  language: string;
}

export const LayoutContext = createContext<Layout>({
  openMobileMenu: () => {},
  isMobile: false,
  menuSlot: null,
  registerHeader: () => () => {},
  language: 'en',
});

export const useLayout = () => useContext(LayoutContext);

/** A Way's own items in the shell's side menu, below the list of Ways; rendered there through a portal. */
export function WayMenu({ children }: { children: ReactNode }) {
  const { menuSlot } = useLayout();
  return menuSlot ? createPortal(children, menuSlot) : null;
}

export interface PageHeaderProps {
  title: ReactNode;
  /** Shown under the title, e.g. a count or a path. */
  subtitle?: ReactNode;
  /** Buttons and fields on the right. */
  children?: ReactNode;
}

/** The header bar of a Way's page, with the menu button on narrow screens. */
export function PageHeader({ title, subtitle, children }: PageHeaderProps) {
  const theme = useTheme();
  const { openMobileMenu, registerHeader, language } = useLayout();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  useEffect(() => registerHeader(), [registerHeader]);

  return (
    <Box
      component="header"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 3,
        py: 1.5,
        minHeight: 59,
        flexShrink: 0,
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      {isMobile && (
        <Tooltip title={shellText(language, 'openMenu')}>
          <IconButton size="small" onClick={openMobileMenu} aria-label={shellText(language, 'openMenu')}>
            <MenuIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
      <Box sx={{ minWidth: 0, flex: children ? '0 1 auto' : 1 }}>
        <Typography component="h1" noWrap sx={{ fontSize: '1rem', fontWeight: 700, lineHeight: 1.2 }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="caption" color="text.secondary" noWrap component="div">
            {subtitle}
          </Typography>
        )}
      </Box>
      {children && <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, justifyContent: 'flex-end', minWidth: 0 }}>{children}</Box>}
    </Box>
  );
}
