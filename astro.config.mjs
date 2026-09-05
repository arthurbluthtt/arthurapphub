// @ts-check
import { defineConfig } from 'astro/config';

import cloudflare from '@astrojs/cloudflare';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://arthurapphub.arthurbluthtt.workers.dev',
  adapter: cloudflare(),
  prefetch: { defaultStrategy: 'hover' },
  session: {
    driver: {
      entrypoint: new URL('./src/lib/astro-session-null.ts', import.meta.url),
    },
  },
  vite: {
    plugins: [tailwindcss()],
    server: {
      watch: {
        ignored: ['**/.wrangler/**'],
      },
    },
  },
});
