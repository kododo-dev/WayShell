// A Way module that loads part of itself with import(), as CultureWay does with its flags.
import { Suspense, lazy } from 'react';
import { defineWay } from '@kododo-dev/way-shell';

const Details = lazy(() => import('./details.js'));

export default defineWay({
  App: () => (
    <Suspense>
      <Details />
    </Suspense>
  ),
});
