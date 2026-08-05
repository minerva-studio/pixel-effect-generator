import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Desktop renderer uses relative asset paths so the packaged app works from a
// portable folder; the GitHub Pages build keeps its own base in vite.config.ts.
export default defineConfig({
  base: './',
  plugins: [react()],
})
