// A lazily loaded part that shares a module with way.js.
import { Suspense, lazy } from 'react';
import { defineWay } from '@kododo-dev/way-shell';
import { label } from './label.js';

const Details = lazy(() => import('./details.js'));

export default defineWay({
  App: () => (
    <Suspense fallback={label}>
      <Details />
    </Suspense>
  ),
});
