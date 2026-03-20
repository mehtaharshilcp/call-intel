import { forwardToGroq } from '../../../_forward'

const GROQ_TRANSCRIBE_URL = 'https://api.groq.com/openai/v1/audio/transcriptions'

function apiKey(): string | undefined {
  return process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY
}

function isAllowedBlobUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return (
      u.protocol === 'https:' &&
      (u.hostname.endsWith('.blob.vercel-storage.com') ||
        u.hostname.endsWith('.public.blob.vercel-storage.com'))
    )
  } catch {
    return false
  }
}

/** Small JSON body + fetch from Blob avoids Vercel FUNCTION_PAYLOAD_TOO_LARGE on big audio. */
async function transcribeFromBlobRef(request: Request): Promise<Response> {
  const key = apiKey()
  if (!key) {
    console.error('[groq-transcribe] missing API key')
    return new Response(
      JSON.stringify({ error: 'Server misconfigured: API key not set' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  type Body = { url?: string; filename?: string; model?: string }
  let raw: Body
  try {
    raw = (await request.json()) as Body
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const refUrl = raw.url
  if (!refUrl || !isAllowedBlobUrl(refUrl)) {
    console.warn('[groq-transcribe] rejected blob url')
    return new Response(JSON.stringify({ error: 'Invalid or disallowed audio url' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const audioRes = await fetch(refUrl)
  if (!audioRes.ok) {
    console.error('[groq-transcribe] fetch blob failed', audioRes.status)
    return new Response(JSON.stringify({ error: 'Could not read audio from storage' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const buf = await audioRes.arrayBuffer()
  const filename = raw.filename || 'audio.webm'
  const model = raw.model || 'whisper-large-v3-turbo'

  const form = new FormData()
  form.append('file', new Blob([buf]), filename)
  form.append('model', model)
  form.append('response_format', 'verbose_json')
  form.append('timestamp_granularities[]', 'segment')

  console.log('[groq-transcribe] transcribing from blob', refUrl.slice(0, 80), 'bytes', buf.byteLength)

  const groqRes = await fetch(GROQ_TRANSCRIBE_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  })

  if (!groqRes.ok) {
    const snippet = await groqRes.clone().text().catch(() => '')
    console.error('[groq-transcribe] groq error', groqRes.status, snippet.slice(0, 600))
  }

  const out = new Headers(groqRes.headers)
  out.delete('transfer-encoding')

  return new Response(groqRes.body, {
    status: groqRes.status,
    statusText: groqRes.statusText,
    headers: out,
  })
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    console.warn('[groq-transcribe] rejected method', request.method)
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const ct = request.headers.get('content-type') || ''
  if (ct.includes('application/json')) {
    return transcribeFromBlobRef(request)
  }

  return forwardToGroq(request, '/openai/v1/audio/transcriptions')
}
