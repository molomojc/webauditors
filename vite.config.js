import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Mounts the serverless collector during `npm run dev`, so the live scan flow
// works locally without the Vercel CLI. In production the same file is served
// by Vercel as a Node function.
function scanApi() {
  return {
    name: 'webauditors-scan-api',
    configureServer(server) {
      server.middlewares.use('/api/scan', async (request, response) => {
        try {
          const module = await server.ssrLoadModule('/api/scan.js')
          await module.default(request, response)
        } catch (error) {
          if (!response.headersSent) {
            response.statusCode = 500
            response.setHeader('content-type', 'application/json')
          }
          response.end(
            JSON.stringify({
              ok: false,
              code: 'dev_api_error',
              error: String(error?.message ?? error),
            }),
          )
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), scanApi()],
})
