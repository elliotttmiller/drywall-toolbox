import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// ReactPress serves the built app from:
//   wp-content/reactpress/apps/contacts/
// so all asset URLs must be rooted at that path.
// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/wp-content/reactpress/apps/contacts/',
  build: {
    outDir: 'dist',
    // Ensure assets stay in a predictable sub-folder so ReactPress can serve them
    assetsDir: 'assets',
  },
})
