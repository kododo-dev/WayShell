// The shell's page: reads the settings the backend put into it and renders the shell from @kododo-dev/way-shell.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ShellApp, type ShellSettings } from '@kododo-dev/way-shell';

const settings = JSON.parse(document.getElementById('way-shell-settings')?.textContent ?? 'null') as ShellSettings | null;
const root = createRoot(document.getElementById('root')!);

root.render(
  settings ? (
    <StrictMode>
      <ShellApp settings={settings} />
    </StrictMode>
  ) : (
    <p>Way.Shell: the page has no settings.</p>
  ),
);
