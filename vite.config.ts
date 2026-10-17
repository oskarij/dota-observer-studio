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
      // The packaged web host serves /events and /media itself. In dev, proxy them to the overlay
      // host; this assumes its default port.
      '/events': { target: 'http://127.0.0.1:3333', changeOrigin: false },
      '/media': { target: 'http://127.0.0.1:3333', changeOrigin: false }
    }
  }
});
