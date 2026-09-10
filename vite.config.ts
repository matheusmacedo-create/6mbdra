import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  worker: {
    format: 'es',
  },
  build: {
    target: 'es2022',
    // Ghostscript WASM glue is large; silence the size warning for that chunk.
    chunkSizeWarningLimit: 4000,
  },
  optimizeDeps: {
    exclude: ['@jspawn/ghostscript-wasm'],
  },
})
