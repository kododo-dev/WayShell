import { resolve } from 'node:path';
import type { Plugin, UserConfig } from 'vite';
import { CONTRACT } from '../contract.js';
import { SHARED_LIBRARIES } from '../shared.js';
import { USE_SYNC_EXTERNAL_STORE } from './shims.js';

export interface WayModuleOptions {
  /** The module's entry, whose default export is `defineWay(...)`. Default: `src/way.tsx`. */
  entry?: string;
  /** Default: `dist`. The Way's `.csproj` embeds this folder. */
  outDir?: string;
}

const ENTRY = '\0kododo-way:entry';
const DEEP = '\0kododo-way:deep/';
const SYNC_STORE = '\0kododo-way:use-sync-external-store';

/** What the build hooks need from Rollup's plugin context. */
interface PluginContext {
  error(message: string): never;
}

const shared = new Set<string>(SHARED_LIBRARIES);

/** Packages resolved to one copy, also in `vite dev`: the shared libraries and the icons built on them. */
const DEDUPE = [
  'react', 'react-dom', '@emotion/react', '@emotion/styled', '@mui/material', '@mui/system', '@mui/icons-material',
  'react-router', 'react-router-dom',
];

/** Shared packages whose subpaths (`@mui/material/Button`) a module may import: they are rewritten to the root. */
const DEEP_IMPORTS = /^(@mui\/material|@mui\/system)\/([A-Za-z]\w*)(?:\/index(?:\.m?js)?)?$/;

/**
 * Packages a module must never bundle: the shared libraries and the internals they keep state in. Reaching one of
 * these files means an import the shell cannot share, which would give the module a second copy with its own
 * contexts (theme, router, hooks).
 */
const SINGLETON_FILES =
  /[\\/]node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom|@emotion[\\/](?:react|styled|cache)|@mui[\\/](?:material|system|styled-engine))[\\/]/;

/**
 * Builds a Way's UI as an ES module for Way.Shell: `dist/way.js` and `dist/way.css`, with the shared libraries left
 * as bare imports for the shell's import map. Use it next to `@vitejs/plugin-react`:
 *
 * ```ts
 * export default defineConfig({ plugins: [react(), wayModule()] });
 * ```
 *
 * In `vite dev` it only keeps one copy of each shared library, for WayDevHost.
 */
export function wayModule(options: WayModuleOptions = {}): Plugin {
  let root = process.cwd();
  let building = false;
  return {
    name: 'kododo-way-module',
    enforce: 'pre',

    config: (_, env) => ({
      resolve: { dedupe: DEDUPE },
      ...(env.command === 'build' ? buildConfig(options) : {}),
    }),

    configResolved(config) {
      root = config.root;
      building = config.command === 'build';
    },

    // Vite resolves lib.entry as a path; the input is swapped here for the wrapper that adds the contract.
    options: (input) => (building ? { ...input, input: { way: ENTRY } } : input),

    resolveId(id) {
      return building ? resolveForBuild(this, id) : null;
    },

    // A CommonJS dependency that require()s a shared library cannot get it from the import map; it would only fail
    // in the browser ("Calling require … in an environment that doesn't expose require").
    transform(code, id) {
      // Only JavaScript files: dependencies. The Way's own TypeScript is ES modules.
      if (!building || !/\.c?js$/.test(id.split('?')[0]) || !code.includes('require(')) return null;
      for (const [, library] of code.matchAll(/\brequire\(\s*["']([^"']+)["']\s*\)/g))
        if (isShared(library)) this.error(requireMessage(`'${library}'`, id));
      return null;
    },

    load(id) {
      return building ? loadForBuild(this, id, resolve(root, options.entry ?? 'src/way.tsx')) : null;
    },

    // The same, for whatever reached the output without passing through resolveId as a require.
    generateBundle(_, bundle) {
      if (!building) return;
      for (const chunk of Object.values(bundle))
        if (chunk.type === 'chunk' && chunk.code.includes("environment that doesn't expose the `require` function"))
          this.error(requireMessage('a shared library', chunk.fileName));
    },
  };
}

const isShared = (id: string) => shared.has(id) || /^(react|react-dom)\//.test(id);

function requireMessage(library: string, importer: string | undefined) {
  return (
    `A CommonJS dependency of the Way module require()s ${library}${importer ? ` (${importer})` : ''}, which only the ` +
    "shell's import map provides. Use an ES module build of that dependency, or ask for a stand-in in wayModule()."
  );
}

function buildConfig(options: WayModuleOptions): UserConfig {
  return {
    // Library mode leaves process.env.NODE_ENV alone; React and MUI would keep their development branches.
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: {
      outDir: options.outDir ?? 'dist',
      emptyOutDir: true,
      lib: { entry: options.entry ?? 'src/way.tsx', formats: ['es'], fileName: () => 'way.js', cssFileName: 'way' },
      rollupOptions: { external: (id: string) => shared.has(id) },
    },
  };
}

function resolveForBuild(context: PluginContext, id: string) {
  if (id === ENTRY) return ENTRY;
  if (id === 'react/jsx-dev-runtime')
    context.error(
      'The module is compiled with development JSX (react/jsx-dev-runtime), which the shell does not provide. ' +
        'Build with NODE_ENV=production, as `vite build` does unless NODE_ENV is set otherwise.',
    );
  // react-router-dom re-exports react-router; importing the latter directly would bundle a second router.
  if (id === 'react-router') return { id: 'react-router-dom', external: true };
  // CommonJS around require('react'): an ES module stand-in on the shared React instead.
  if (/^use-sync-external-store(?:\/shim)?(?:\/with-selector)?(?:\.js)?$/.test(id)) return SYNC_STORE;
  // '@mui/material/Button', '@mui/material/SvgIcon' (from @mui/icons-material), '@mui/system/createStyled' (from
  // MUI X) are not in the import map; everything they export is exported by the package's root too.
  const deep = DEEP_IMPORTS.exec(id);
  return deep ? `${DEEP}${deep[1]}/${deep[2]}` : null;
}

async function loadForBuild(context: PluginContext, id: string, entry: string) {
  if (id === ENTRY)
    return `import way from ${JSON.stringify(entry.replaceAll('\\', '/'))};\nexport default { ...way, contract: ${CONTRACT} };\n`;
  if (id === SYNC_STORE) return USE_SYNC_EXTERNAL_STORE;
  if (id.startsWith(DEEP)) {
    const [, pkg, name] = /^(.+)\/([^/]+)$/.exec(id.slice(DEEP.length))!;
    // A subpath's default export is the root's export of the same name: Button, useMediaQuery, createStyled.
    const hasDefault = (await exportsOf(pkg)).has(name);
    return `export * from '${pkg}';\n` + (hasDefault ? `export { ${name} as default } from '${pkg}';\n` : '');
  }
  const singleton = SINGLETON_FILES.exec(id);
  if (singleton)
    context.error(
      `${singleton[1].replace('\\', '/')} would be bundled into the Way module (${id}). ` +
        `Import shared libraries only by their root specifiers (${SHARED_LIBRARIES.join(', ')}); ` +
        'a library that depends on other parts of them cannot be used in a Way module yet.',
    );
  return null;
}

const exportNames = new Map<string, Promise<Set<string>>>();

/** Names a shared package exports from its root, as installed next to the build. */
function exportsOf(pkg: string): Promise<Set<string>> {
  let names = exportNames.get(pkg);
  if (!names) {
    names = import(pkg).then((m: Record<string, unknown>) => new Set(Object.keys(m)), () => new Set<string>());
    exportNames.set(pkg, names);
  }
  return names;
}

export { SHARED_LIBRARIES };
