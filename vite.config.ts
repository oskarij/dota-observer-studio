import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      // The overlay host (default port 3333) serves the realtime /events SSE route. Proxy it so the
      // studio preview connects same-origin in dev, matching packaged builds where the web host
      // serves /events directly.
      '/events': { target: 'http://127.0.0.1:3333', changeOrigin: false }
    }
  }
});
