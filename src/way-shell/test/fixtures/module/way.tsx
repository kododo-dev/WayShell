// A Way module using what tends to pull a second copy of a shared library into the bundle: deep MUI imports, an icon
// (imports @mui/material/SvgIcon), react-router instead of react-router-dom, and its own CSS.
import Button from '@mui/material/Button';
import { useTheme } from '@mui/material/styles';
import Stack from '@mui/material/Stack';
import SettingsIcon from '@mui/icons-material/Settings';
import { Route, Routes } from 'react-router';
import { defineWay, useShell } from '@kododo-dev/way-shell';
import './way.css';

function Home() {
  const shell = useShell();
  const theme = useTheme();
  return (
    <Stack className="fixture" sx={{ color: theme.palette.primary.main }}>
      <SettingsIcon />
      <Button onClick={() => shell.navigate(shell.wayId, 'details')}>Details</Button>
    </Stack>
  );
}

export default defineWay({
  App: () => (
    <Routes>
      <Route index element={<Home />} />
    </Routes>
  ),
});
