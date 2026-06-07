import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const config = {
  kit: {
    adapter: adapter({
      assets: 'build/web',
      fallback: 'index.html',
      pages: 'build/web'
    })
  },
  preprocess: vitePreprocess()
};

export default config;
