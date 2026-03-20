const UPSTREAM = 'https://api.groq.com'

function apiKey(): string | undefined {
  return process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY
}

/**
 * Proxy a browser request to Groq’s OpenAI-compatible API.
 * Buffers the body — streaming `request.body` with `duplex: 'half'` often crashes Vercel Node serverless.
 */
export async function forwardToGroq(request: Request, upstreamPath: string): Promise<Response> {
  try {
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

    let body: ArrayBuffer | undefined
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      body = await request.arrayBuffer()
    }

    const upstream = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: body && body.byteLength > 0 ? body : undefined,
    })

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
  } catch (e) {
    console.error('[groq-proxy] unhandled', e)
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : 'Proxy failed',
        detail: 'Check Vercel function logs',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
