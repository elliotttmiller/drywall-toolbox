import {defineConfig} from 'vite';
import {hydrogen} from '@shopify/hydrogen/vite';
import {reactRouter} from '@react-router/dev/vite';

export default defineConfig({
  plugins: [
    hydrogen(),
    reactRouter(),
  ],
  resolve: {
    alias: {
      '~': new URL('./app', import.meta.url).pathname,
    },
  },
  server: {
    port: 3000,
    host: true,
  },
  build: {
    assetsDir: '_assets',
  },
});
