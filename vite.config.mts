import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/pixel-effect-generator/',
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'locales', test: /\/src\/i18n\/resources\// },
            { name: 'react-vendor', test: /\/node_modules\/(?:react|react-dom|scheduler)\// },
          ],
        },
      },
    },
  },
})
