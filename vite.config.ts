import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import webExtension from 'vite-plugin-web-extension'

export default defineConfig({
  plugins: [react(), tailwindcss(), webExtension({ additionalInputs: ['index.html'] })],
})
