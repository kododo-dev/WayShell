import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { SHARED_LIBRARIES } from '../../way-shell/src/shared.ts';

const runtime = resolve(import.meta.dirname, '../../way-shell/src/index.ts');
const entryName = (specifier: string) => specifier.replace(/^@/, '').replaceAll('/', '-');
const sourceOf = (specifier: string) =>
  specifier === '@kododo-dev/way-shell' ? runtime : resolve(import.meta.dirname, 'vendor', `${entryName(specifier)}.js`);

/**
 * Writes shell.json for the backend: the import map (specifier -> file), the shell app's entry and the files to
 * preload with it.
 */
function shellManifest(): Plugin {
  return {
    name: 'way-shell-manifest',
    generateBundle(_, bundle) {
      const chunks = Object.values(bundle).filter((c) => c.type === 'chunk');
      const entryOf = (source: string) => {
        const chunk = chunks.find((c) => c.isEntry && c.facadeModuleId?.replaceAll('\\', '/') === source.replaceAll('\\', '/'));
        if (!chunk) throw new Error(`No entry chunk for ${source}`);
        return chunk;
      };
      const imports = Object.fromEntries(SHARED_LIBRARIES.map((s) => [s, entryOf(sourceOf(s)).fileName]));
      const app = entryOf(resolve(import.meta.dirname, 'src/main.tsx'));
      const preload: string[] = [];
      const walk = (file: string) => {
        if (preload.includes(file)) return;
        preload.push(file);
        chunks.find((c) => c.fileName === file)?.imports.forEach(walk);
      };
      walk(app.fileName);
      const css = [...(app.viteMetadata?.importedCss ?? [])];
      this.emitFile({ type: 'asset', fileName: 'shell.json', source: JSON.stringify({ imports, entry: app.fileName, preload, css }, null, 2) });
    },
  };
}

// One build for the shared libraries, the runtime and the shell app: they share chunks, so the shell and every Way
// module importing 'react' through the import map get the same instance.
export default defineConfig({
  plugins: [react(), shellManifest()],
  base: '',
  resolve: {
    alias: { '@kododo-dev/way-shell': runtime },
    // The runtime's sources sit next to their own node_modules; its imports must resolve to the copies here.
    dedupe: ['react', 'react-dom', '@emotion/react', '@emotion/styled', '@mui/material', '@mui/system', '@mui/icons-material', 'react-router-dom', 'react-router'],
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      // Vite strips the exports of entries by default; the shared libraries are entries to import from.
      preserveEntrySignatures: 'strict',
      input: {
        ...Object.fromEntries(SHARED_LIBRARIES.map((s) => [entryName(s), sourceOf(s)])),
        shell: 'src/main.tsx',
      },
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
