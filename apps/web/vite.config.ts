import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined
          if (/react(-dom|-router)?\//.test(id)) return 'react'
          if (id.includes('@radix-ui')) return 'radix'
          // recharts + its d3-* deps — only pulled in by the lazily-loaded
          // /analytics route, so keep it in its own chunk out of the
          // initial bundle.
          if (/recharts|d3-|victory-vendor|internmap/.test(id)) return 'charts'
          if (/@tanstack|@supabase|react-hook-form|\bzod\b/.test(id)) return 'vendor'
          return undefined
        },
      },
    },
  },
})
