import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative base + HashRouter makes the build portable to any GitHub Pages
// path (project site, user site, or custom domain) with no rebuild needed.
export default defineConfig({
  base: './',
  plugins: [react()],
})
