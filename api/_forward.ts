const UPSTREAM = 'https://api.groq.com'

function apiKey(): string | undefined {
  return process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY
}

/**
 * Proxy to Groq. Buffers request + response bodies for environments that mishandle streams.
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

    const outBody = await upstream.arrayBuffer()
    const outType = upstream.headers.get('content-type') || 'application/json'

    if (!upstream.ok) {
      const snippet = new TextDecoder().decode(outBody.slice(0, 800))
      console.error('[groq-proxy] upstream error', upstream.status, snippet)
    }

    return new Response(outBody, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: { 'Content-Type': outType },
    })
  } catch (e) {
    console.error('[groq-proxy] unhandled', e)
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : 'Proxy failed',
        detail: 'Check server logs',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
