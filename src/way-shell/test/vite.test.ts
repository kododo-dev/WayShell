import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import react from '@vitejs/plugin-react';
import { build, createLogger } from 'vite';
import { describe, expect, it } from 'vitest';
import { CONTRACT, SHARED_LIBRARIES } from '../src/index.js';
import { wayModule, type WayModuleOptions } from '../src/vite/index.js';

const fixture = (name: string) => join(import.meta.dirname, 'fixtures', name);

async function buildFixture(name: string, nodeEnv = 'production', options: WayModuleOptions = {}, warnings: string[] = []) {
  // Vitest runs with NODE_ENV=test, which makes the React plugin emit development JSX; `vite build` runs with production.
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = nodeEnv;
  try {
    return await buildWithPreset(name, options, warnings);
  } finally {
    process.env.NODE_ENV = previous;
  }
}

function buildWithPreset(name: string, options: WayModuleOptions, warnings: string[]) {
  const logger = createLogger('silent');
  logger.warn = (message) => warnings.push(message);
  return build({
    root: fixture(name),
    configFile: false,
    customLogger: logger,
    plugins: [react(), wayModule({ entry: 'way.tsx', ...options })],
  });
}

/** Bare specifiers the built module imports. */
function importsOf(code: string) {
  return [...code.matchAll(/(?:^|[;\s])(?:import|export)\b[^'"]*?from\s*["']([^"']+)["']|import\s*["']([^"']+)["']/gm)]
    .map((m) => m[1] ?? m[2])
    .filter((s) => !s.startsWith('.'));
}

describe('wayModule()', () => {
  it('builds way.js and way.css with the shared libraries left to the import map', async () => {
    await buildFixture('module');
    const dist = join(fixture('module'), 'dist');
    const code = readFileSync(join(dist, 'way.js'), 'utf8');

    const imports = new Set(importsOf(code));
    expect([...imports].every((s) => (SHARED_LIBRARIES as readonly string[]).includes(s))).toBe(true);
    expect(imports).toContain('@mui/material');
    expect(imports).toContain('react-router-dom');
    expect(existsSync(join(dist, 'way.css'))).toBe(true);
    // A second copy of MUI or React would add hundreds of kilobytes; the module's own code is a few.
    expect(statSync(join(dist, 'way.js')).size).toBeLessThan(20_000);
  });

  it('records the contract the module was built for', async () => {
    await buildFixture('module');
    const code = readFileSync(join(fixture('module'), 'dist', 'way.js'), 'utf8');
    expect(code).toMatch(new RegExp(`contract:\\s*${CONTRACT}\\b`));
  });

  it('puts what the module loads with import() in content-named chunks next to way.js', async () => {
    await buildFixture('lazy');
    const chunks = join(fixture('lazy'), 'dist', 'chunks');
    const [chunk, ...others] = readdirSync(chunks);
    expect(others).toEqual([]);
    expect(chunk).toMatch(/^details-[\w-]+\.js$/);
    expect(readFileSync(join(fixture('lazy'), 'dist', 'way.js'), 'utf8')).toContain(`./chunks/${chunk}`);
    expect(importsOf(readFileSync(join(chunks, chunk), 'utf8')).sort()).toEqual(['@mui/material', 'react/jsx-runtime']);
  });

  it('puts a module that way.js and a lazy chunk share in a chunk of its own, not behind way.js', async () => {
    // The shell imports way.js with a version in the query; a chunk importing plain way.js would get a second copy.
    await buildFixture('lazy-imports-entry');
    const chunks = join(fixture('lazy-imports-entry'), 'dist', 'chunks');
    const names = readdirSync(chunks);
    expect(names.some((n) => n.startsWith('label-'))).toBe(true);
    for (const name of names) expect(readFileSync(join(chunks, name), 'utf8')).not.toMatch(/way\.js/);
  });

  it('warns when way.js is big, and only then', async () => {
    const big: string[] = [];
    await buildFixture('module', 'production', { sizeWarningKb: 1 }, big);
    expect(big.some((w) => /way\.js is \d+ KB after gzip \(more than 1 KB\).*import\(\)/s.test(w))).toBe(true);

    const small: string[] = [];
    await buildFixture('module', 'production', {}, small);
    expect(small.some((w) => w.includes('after gzip'))).toBe(false);
  });

  it('refuses to bundle a package that keeps state the shell does not share', async () => {
    await expect(buildFixture('bundles-singleton')).rejects.toThrow(/@emotion\/cache would be bundled into the Way module/);
  });

  it('shares @mui/system, rewrites subpaths with their default exports and stands in for use-sync-external-store', async () => {
    await buildFixture('uses-mui-x-deps');
    const code = readFileSync(join(fixture('uses-mui-x-deps'), 'dist', 'way.js'), 'utf8');

    const imports = new Set(importsOf(code));
    expect([...imports].every((s) => (SHARED_LIBRARIES as readonly string[]).includes(s))).toBe(true);
    expect(imports).toContain('@mui/system');
    expect(code).toMatch(/import \{[^}]*createStyled[^}]*\} from "@mui\/system"/);
    expect(code).toMatch(/import \{[^}]*useMediaQuery[^}]*\} from "@mui\/material"/);
    expect(code).not.toMatch(/require\(/);
    expect(statSync(join(fixture('uses-mui-x-deps'), 'dist', 'way.js')).size).toBeLessThan(20_000);
  });

  it('refuses a CommonJS dependency that require()s a shared library', async () => {
    await expect(buildFixture('requires-react')).rejects.toThrow(/require\(\)s 'react'/);
  });

  it('explains a build with development JSX', async () => {
    await expect(buildFixture('module', 'development')).rejects.toThrow(/development JSX.*NODE_ENV=production/s);
  });

  it('in vite dev only keeps one copy of the shared libraries', () => {
    const config = (wayModule().config as (c: object, env: { command: string; mode: string }) => { resolve?: { dedupe?: string[] }; build?: unknown })(
      {},
      { command: 'serve', mode: 'development' },
    );
    expect(config.resolve?.dedupe).toEqual(expect.arrayContaining(['react', '@mui/material', 'react-router-dom']));
    expect(config.build).toBeUndefined();
  });
});
