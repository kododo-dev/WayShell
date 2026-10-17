// Imports a package that keeps state the shell must share but does not provide; the build must refuse it.
import createCache from '@emotion/cache';
import { defineWay } from '@kododo-dev/way-shell';

const cache = createCache({ key: 'own' });
export default defineWay({ App: () => <p>{cache.key}</p> });
