// `npm run dev`: the module inside WayDevHost, the same shell as in the app, with Vite's hot reload. The API goes
// through Vite's proxy to the demo backend (dotnet run in ..).
import { createRoot } from 'react-dom/client';
import { WayDevHost } from '@kododo-dev/way-shell';
import way from './way';

createRoot(document.getElementById('root')!).render(
  <WayDevHost way={way} id="hello" name="Hello" apiBase="/hello/api" user={{ name: 'developer' }} />,
);
