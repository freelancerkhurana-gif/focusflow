import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true
  },
  build: {
    // Ensure public files are copied to root
    copyPublicDir: true,
    // Generate sourcemaps for debugging (optional)
    sourcemap: false
  },
  // Ensure proper serving of public files
  publicDir: 'public',
  // Base path for deployment (adjust if deploying to subdirectory)
  base: '/'
})
