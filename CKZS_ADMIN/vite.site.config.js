import { cloudflare } from '@cloudflare/vite-plugin'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { sites } from './build/sites-vite-plugin.js'

export default defineConfig({
  base: '/',
  plugins: [
    vue(),
    sites(),
    cloudflare({
      viteEnvironment: { name: 'server' },
      config: {
        name: 'ckzs-device-admin',
        main: './worker/index.js',
        compatibility_date: '2026-05-22',
        assets: {
          binding: 'ASSETS',
          not_found_handling: 'single-page-application',
          run_worker_first: ['/api/*'],
        },
      },
    }),
  ],
})
