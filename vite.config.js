import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Mounts the serverless handlers during `npm run dev`, so the live and agent
// flows work locally without the Vercel CLI. In production the same files are
// served by Vercel as Node functions.
function scanApi() {
  const routes = [
    ['/api/scan', '/api/scan.js'],
    ['/api/agent/scan', '/api/agent/scan.js'],
  ]

  return {
    name: 'webauditors-scan-api',
    configureServer(server) {
      for (const [route, modulePath] of routes) {
        server.middlewares.use(route, async (request, response) => {
          try {
            const module = await server.ssrLoadModule(modulePath)
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
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), scanApi()],
})
