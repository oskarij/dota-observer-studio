import { resolve } from 'node:path';
import { build } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

await build({
  logLevel: 'warn',
  configFile: false,
  plugins: [svelte({ configFile: false })],
  root: resolve('tests/performance'),
  base: './',
  publicDir: resolve('static'),
  resolve: {
    alias: { '$app/paths': resolve('tests/performance/appPathsStub.ts'), $lib: resolve('src/lib') }
  },
  build: { outDir: resolve('build/performance'), emptyOutDir: true }
});
