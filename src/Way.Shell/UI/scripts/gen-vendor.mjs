// Writes one entry file per shared library into vendor/. The shell builds them as ES modules and maps the bare
// specifiers to them in its import map, so the list comes from the npm package's SHARED_LIBRARIES.
import { createRequire } from 'node:module';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { SHARED_LIBRARIES } from '../../../way-shell/src/shared.ts';

process.env.NODE_ENV = 'production';
const require = createRequire(import.meta.url);
const out = new URL('../vendor/', import.meta.url);
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

/** File name of a specifier's entry, e.g. 'react/jsx-runtime' -> 'react-jsx-runtime'. */
export const entryName = (specifier) => specifier.replace(/^@/, '').replaceAll('/', '-');

// React's packages are CommonJS: `export *` cannot see their names statically, so they are listed from the
// production build. The others are ES modules.
const isReact = (specifier) => /^react(-dom)?(\/|$)/.test(specifier);

for (const specifier of SHARED_LIBRARIES) {
  if (specifier === '@kododo-dev/way-shell') continue; // the runtime is built from source, see vite.config.ts
  let source;
  if (isReact(specifier)) {
    const names = Object.keys(require(specifier)).filter((n) => n !== 'default' && /^[A-Za-z_$][\w$]*$/.test(n));
    source = `import m from '${specifier}';\nexport default m;\nexport const { ${names.join(', ')} } = m;\n`;
  } else {
    const module = await import(specifier);
    source = `export * from '${specifier}';\n` + ('default' in module ? `export { default } from '${specifier}';\n` : '');
  }
  writeFileSync(new URL(`${entryName(specifier)}.js`, out), source);
}

console.log(`vendor: ${SHARED_LIBRARIES.length - 1} entries`);
