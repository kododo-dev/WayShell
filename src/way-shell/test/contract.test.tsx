import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CONTRACT, ShellContext, createApi, defineWay, useShell, type WayProps } from '../src/index.js';

const props: WayProps = {
  wayId: 'config',
  apiBase: '/config/api',
  user: { name: 'admin' },
  language: 'en',
  themeMode: 'light',
  settings: {},
  api: createApi('/config/api'),
  ways: [{ id: 'config', name: 'Configuration' }],
  navigate: () => {},
  href: () => null,
};

function ShowsWay() {
  const shell = useShell();
  return <span>{shell.wayId}</span>;
}

describe('contract', () => {
  it('is the major version of Way.Shell, 2', () => {
    expect(CONTRACT).toBe(2);
  });

  it('defineWay returns the options unchanged, the preset adds the contract', () => {
    const App = () => null;
    expect(defineWay({ App })).toEqual({ App });
  });
});

describe('useShell', () => {
  it('returns what the shell provides', () => {
    const html = renderToString(
      <ShellContext.Provider value={props}>
        <ShowsWay />
      </ShellContext.Provider>,
    );
    expect(html).toBe('<span>config</span>');
  });

  it('throws outside of the shell', () => {
    expect(() => renderToString(<ShowsWay />)).toThrow(/outside of Way\.Shell/);
  });
});
