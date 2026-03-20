import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const groqKey = env.GROQ_API_KEY || ''

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/groq': {
          target: 'https://api.groq.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/groq/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              if (groqKey) {
                proxyReq.setHeader('Authorization', `Bearer ${groqKey}`)
              }
            })
          },
        },
      },
    },
  }
})
