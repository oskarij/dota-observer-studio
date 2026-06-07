import { resolve } from 'node:path';

import { defineConfig } from 'vite';

export default defineConfig({
  base: '/overlay/',
  root: resolve(import.meta.dirname, 'src/overlay'),
  build: {
    emptyOutDir: true,
    outDir: resolve(import.meta.dirname, 'build/overlay-assets/overlay'),
    rollupOptions: {
      input: resolve(import.meta.dirname, 'src/overlay/index.html')
    }
  }
});
