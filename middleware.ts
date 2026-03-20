/**
 * Vercel Routing Middleware — proxies `/groq/*` → `https://api.groq.com/*` with `GROQ_API_KEY`.
 * Vite’s dev proxy (vite.config.ts) does not run in production.
 * @see https://vercel.com/docs/routing-middleware/api
 */
export const config = {
  matcher: ['/groq/:path*'],
}

export default async function middleware(request: Request): Promise<Response> {
  const key = process.env.GROQ_API_KEY
  if (!key) {
    return new Response(JSON.stringify({ error: 'GROQ_API_KEY is not set in Vercel env' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const url = new URL(request.url)
  const path = url.pathname.replace(/^\/groq/, '') || '/'
  const targetUrl = `https://api.groq.com${path}${url.search}`

  const headers = new Headers(request.headers)
  headers.set('Authorization', `Bearer ${key}`)
  headers.delete('host')

  const init: RequestInit & { duplex?: 'half' } = {
    method: request.method,
    headers,
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = request.body
    init.duplex = 'half'
  }

  return fetch(targetUrl, init)
}
