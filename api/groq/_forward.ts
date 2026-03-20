const UPSTREAM = 'https://api.groq.com'

function apiKey(): string | undefined {
  return process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY
}

/**
 * Proxy a browser request to Groq’s OpenAI-compatible API.
 * `upstreamPath` must be absolute on Groq host, e.g. `/openai/v1/audio/transcriptions`.
 */
export async function forwardToGroq(request: Request, upstreamPath: string): Promise<Response> {
  const key = apiKey()
  if (!key) {
    console.error('[groq-proxy] missing GROQ_API_KEY / OPENAI_API_KEY')
    return new Response(
      JSON.stringify({ error: 'Server misconfigured: API key not set (GROQ_API_KEY or OPENAI_API_KEY)' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const path = upstreamPath.startsWith('/') ? upstreamPath : `/${upstreamPath}`
  const url = new URL(request.url)
  const targetUrl = `${UPSTREAM}${path}${url.search}`

  console.log('[groq-proxy]', request.method, path)

  const headers = new Headers()
  headers.set('Authorization', `Bearer ${key}`)
  const ct = request.headers.get('content-type')
  if (ct) headers.set('Content-Type', ct)
  const accept = request.headers.get('accept')
  if (accept) headers.set('Accept', accept)

  const init: RequestInit & { duplex?: 'half' } = {
    method: request.method,
    headers,
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = request.body
    init.duplex = 'half'
  }

  let upstream: Response
  try {
    upstream = await fetch(targetUrl, init)
  } catch (e) {
    console.error('[groq-proxy] fetch failed', e)
    return new Response(JSON.stringify({ error: 'Upstream request failed' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!upstream.ok) {
    const snippet = await upstream.clone().text().catch(() => '')
    console.error('[groq-proxy] upstream error', upstream.status, snippet.slice(0, 800))
  }

  const out = new Headers(upstream.headers)
  out.delete('transfer-encoding')

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: out,
  })
}
