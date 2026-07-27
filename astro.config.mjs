// @ts-check
import { defineConfig } from 'astro/config';

import cloudflare from '@astrojs/cloudflare';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://arthurapphub.pages.dev',
  adapter: cloudflare(),
  prefetch: { defaultStrategy: 'hover' },
  session: { driver: 'lruCache' },
  vite: {
    plugins: [tailwindcss()],
  },
});
