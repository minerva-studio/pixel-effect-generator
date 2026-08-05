import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/pixel-effect-generator/',
  plugins: [react()],
})
