import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  build: {
    // 외부 노출 X, 빌드 산출물로는 생성 (향후 Sentry 업로드용)
    sourcemap: 'hidden',
  },
  esbuild: {
    pure: mode === 'production'
      ? ['console.log', 'console.debug', 'console.info']
      : [],
  },
  server: {
    // allowedHosts: ['localhost', '127.0.0.1', 'macbook-pro'],
    // host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8080',
        ws: true,
        changeOrigin: true,
      },
    },
  },
}))
