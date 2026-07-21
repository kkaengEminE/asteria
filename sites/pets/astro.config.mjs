import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

const site = process.env.ASTERIA_PUBLIC_SITE_URL ?? 'https://pets.asteria.example';

export default defineConfig({
  site,
  output: 'static',
  integrations: [sitemap({ filter: (page) => !page.endsWith('/404/') })]
});
