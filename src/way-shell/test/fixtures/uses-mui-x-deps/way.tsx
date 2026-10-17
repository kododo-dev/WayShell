// What MUI X and other libraries pull in: @mui/system and its subpaths, default exports of subpaths, and
// use-sync-external-store (CommonJS around require('react')).
import { Box } from '@mui/system';
import createStyled from '@mui/system/createStyled';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useSyncExternalStoreWithSelector } from 'use-sync-external-store/shim/with-selector';
import { defineWay } from '@kododo-dev/way-shell';

const styled = createStyled();
const Title = styled('h1')({ margin: 0 });
const subscribe = () => () => {};

function App() {
  const wide = useMediaQuery('(min-width: 600px)');
  const value = useSyncExternalStoreWithSelector(subscribe, () => 1, null, (n: number) => n + 1);
  return <Box><Title>{wide ? value : 0}</Title></Box>;
}

export default defineWay({ App });
