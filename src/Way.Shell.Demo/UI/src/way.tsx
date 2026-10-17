// The demo Way's UI. The demo mounts it twice (Hello and Reports), so it reads which Way it is from the shell.
import { useEffect, useState } from 'react';
import {
  Alert, Button, Card, CardContent, Dialog, DialogActions, DialogContent, DialogTitle, List, ListItemButton, ListItemText,
  Stack, Typography,
} from '@mui/material';
import WavingHandIcon from '@mui/icons-material/WavingHand';
import { Link, Route, Routes, useParams } from 'react-router-dom';
import { ApiError, PageHeader, SessionExpiredError, WayMenu, defineWay, useI18n, useShell } from '@kododo-dev/way-shell';
import './way.css';

interface Hello {
  way: string;
  user: string | null;
  time: string;
}

// Items in the shell's menu navigate with the shell's navigate(wayId, path): router links outside the module's own
// <Routes> resolve against the whole current path of the shell's splat route.
function Menu() {
  const { t } = useI18n();
  const { navigate, wayId } = useShell();
  const path = useParams()['*'] ?? '';
  return (
    <WayMenu>
      <List dense data-testid="demo-menu">
        <ListItemButton selected={path === ''} onClick={() => navigate(wayId, '')}>
          <ListItemText primary={t('overview')} />
        </ListItemButton>
        <ListItemButton selected={path === 'details'} onClick={() => navigate(wayId, 'details')}>
          <ListItemText primary={t('details')} />
        </ListItemButton>
      </List>
    </WayMenu>
  );
}

function Home() {
  const shell = useShell();
  const { t } = useI18n();
  const [hello, setHello] = useState<Hello | string>();
  const [open, setOpen] = useState(false);
  const [expiry, setExpiry] = useState<string>();
  // A link, not navigate(): it also opens in a new tab. Only when the user may open the other Way.
  const otherWay = shell.href(shell.wayId === 'hello' ? 'reports' : 'hello');

  useEffect(() => {
    shell.api.post<Hello>('Hello').then(setHello, (e: Error) => setHello(e.message));
  }, [shell.api]);

  const expire = () =>
    shell.api.post('Expire').catch((e: unknown) =>
      setExpiry(e instanceof SessionExpiredError ? 'session expired' : e instanceof ApiError ? e.messages.join(' ') : String(e)),
    );

  return (
    <>
      <PageHeader title={t('title', { way: shell.wayId })} subtitle={t('subtitle')}>
        <Button size="small" variant="outlined" onClick={() => setOpen(true)}>{t('dialog')}</Button>
      </PageHeader>
      <Stack spacing={2} className="demo-way" data-way={shell.wayId} sx={{ p: 3 }}>
        <Typography variant="h5">
          <WavingHandIcon color="primary" /> {t('hello', { name: shell.user?.name ?? t('anonymous') })}
        </Typography>
        <Card>
          <CardContent>
            <Typography>{t('language')}: {shell.language}, theme: {shell.themeMode}</Typography>
            <Typography data-testid="api">
              API: {hello === undefined ? '…' : typeof hello === 'string' ? `error ${hello}` : `${hello.way} at ${hello.time}`}
            </Typography>
          </CardContent>
        </Card>
        <Stack direction="row" spacing={1}>
          <Button variant="contained" component={Link} to="details">{t('details')}</Button>
          {otherWay && <Button href={otherWay}>{t('otherWay')}</Button>}
          <Button color="warning" onClick={expire}>{t('expire')}</Button>
        </Stack>
        {expiry && <Alert severity="info" data-testid="expiry">{expiry}</Alert>}
        <Dialog open={open} onClose={() => setOpen(false)}>
          <DialogTitle>{shell.wayId}</DialogTitle>
          <DialogContent>{t('dialogBody')}</DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)}>{t('close')}</Button>
          </DialogActions>
        </Dialog>
      </Stack>
    </>
  );
}

function Details() {
  const { wayId } = useShell();
  const { t } = useI18n();
  return (
    <>
      <PageHeader title={t('details')} />
      <Stack spacing={2} sx={{ p: 3 }} data-testid="details">
        <Alert severity="info">{t('detailsBody', { way: wayId })}</Alert>
        <Button component={Link} to="..">{t('back')}</Button>
      </Stack>
    </>
  );
}

function App() {
  return (
    <>
      <Menu />
      <Routes>
        <Route index element={<Home />} />
        <Route path="details" element={<Details />} />
      </Routes>
    </>
  );
}

export default defineWay({
  App,
  translations: {
    en: {
      title: 'Demo: {way}',
      subtitle: 'A module built with wayModule()',
      hello: 'Hello, {name}',
      anonymous: 'stranger',
      language: 'Language',
      overview: 'Overview',
      details: 'Details',
      detailsBody: 'Details of {way}: a route inside the module.',
      back: 'Back',
      dialog: 'Dialog',
      dialogBody: "A dialog rendered by the module, in the shell's theme.",
      close: 'Close',
      otherWay: 'Other Way',
      expire: 'Expire session',
    },
    pl: {
      title: 'Demo: {way}',
      subtitle: 'Moduł zbudowany presetem wayModule()',
      hello: 'Cześć, {name}',
      anonymous: 'nieznajomy',
      language: 'Język',
      overview: 'Przegląd',
      details: 'Szczegóły',
      detailsBody: 'Szczegóły {way}: trasa wewnątrz modułu.',
      back: 'Wróć',
      dialog: 'Okno',
      dialogBody: 'Okno modułu w motywie powłoki.',
      close: 'Zamknij',
      otherWay: 'Inny Way',
      expire: 'Wygaś sesję',
    },
  },
});
