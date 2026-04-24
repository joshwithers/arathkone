import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import { loadShoot } from './src/lib/config.ts';

const shoot = loadShoot();

export default defineConfig({
  output: 'static',
  site: `https://${shoot.site.domain}`,
  image: {
    service: {
      entrypoint: 'astro/assets/services/sharp',
      config: {
        format: 'webp',
        quality: 82,
      },
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
