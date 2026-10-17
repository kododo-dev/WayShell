import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { wayModule } from '@kododo-dev/way-shell/vite';

export default defineConfig({
  plugins: [react(), wayModule()],
  // npm run dev: the API of the demo backend (dotnet run in ..).
  server: { proxy: { '/hello/api': process.env.DEMO_BACKEND ?? 'http://localhost:5085' } },
});
