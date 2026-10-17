import { useEffect, useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';
import { onSessionExpired } from '../api.js';
import { shellText } from '../i18n.js';

/**
 * Shown when any Way's request finds the session expired. Signing in happens in a new tab: the host redirects there
 * to its sign-in page and back, while this page keeps what was not saved yet.
 */
export function SessionExpiredDialog({ language }: { language: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => onSessionExpired(() => setOpen(true)), []);

  return (
    <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
      <DialogTitle>{shellText(language, 'sessionExpiredTitle')}</DialogTitle>
      <DialogContent>
        <DialogContentText>{shellText(language, 'sessionExpiredBody')}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" href={window.location.href} target="_blank" rel="noopener">
          {shellText(language, 'signInAgain')}
        </Button>
        <Button onClick={() => setOpen(false)}>{shellText(language, 'continue')}</Button>
      </DialogActions>
    </Dialog>
  );
}
