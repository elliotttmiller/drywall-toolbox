import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  // Build output goes to repo-root dist/ (outside frontend/)
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Content-hashed filenames for long-term browser caching
        entryFileNames: 'assets/js/[name].[hash].js',
        chunkFileNames: 'assets/js/[name].[hash].js',
        assetFileNames: (assetInfo) => {
          if (/\.(css)$/.test(assetInfo.name)) {
            return 'assets/css/[name].[hash][extname]';
          }
          if (/\.(png|jpe?g|gif|ico|webp|svg)$/.test(assetInfo.name)) {
            return 'assets/images/[name].[hash][extname]';
          }
          if (/\.(woff2?|eot|ttf|otf)$/.test(assetInfo.name)) {
            return 'assets/fonts/[name].[hash][extname]';
          }
          return 'assets/media/[name].[hash][extname]';
        },
      },
    },
  },

  // Path aliases — mirror webpack resolver aliases
  resolve: {
    alias: {
      '@':           resolve(__dirname, 'src'),
      '@api':        resolve(__dirname, 'src/api'),
      '@components': resolve(__dirname, 'src/components'),
      '@hooks':      resolve(__dirname, 'src/hooks'),
      '@pages':      resolve(__dirname, 'src/pages'),
      '@styles':     resolve(__dirname, 'src/styles'),
      '@context':    resolve(__dirname, 'src/context'),
    },
  },

  // Dev server — proxy /wp/wp-json to local WordPress
  server: {
    port: 5173,
    proxy: {
      '/wp/wp-json': {
        target: 'http://localhost',
        changeOrigin: true,
      },
    },
  },
});
