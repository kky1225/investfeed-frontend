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
      // AI 비서 Python 서비스 (FastAPI). /api 와 분리된 별도 프로세스.
      // /assistant 는 React 페이지 경로이기도 하므로 브라우저 페이지 이동(Accept: text/html)은 index.html 로 돌리고 API 호출만 프록시한다
      '/assistant': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        bypass(req) {
          if (req.headers.accept?.includes('text/html')) return '/index.html';
        },
      },
    },
  },
}))
