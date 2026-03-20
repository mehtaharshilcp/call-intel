import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const groqKey = env.GROQ_API_KEY || ''

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api/transcribe': {
          target: 'https://api.groq.com',
          changeOrigin: true,
          rewrite: () => '/openai/v1/audio/transcriptions',
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              if (groqKey) proxyReq.setHeader('Authorization', `Bearer ${groqKey}`)
            })
          },
        },
        '/api/chat': {
          target: 'https://api.groq.com',
          changeOrigin: true,
          rewrite: () => '/openai/v1/chat/completions',
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              if (groqKey) proxyReq.setHeader('Authorization', `Bearer ${groqKey}`)
            })
          },
        },
      },
    },
  }
})
