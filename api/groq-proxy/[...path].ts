import type { VercelRequest, VercelResponse } from '@vercel/node'

export const config = {
  api: {
    bodyParser: false,
  },
}

function readBody(req: VercelRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const key = process.env.GROQ_API_KEY
  if (!key) {
    res.status(500).json({ error: 'GROQ_API_KEY is not set in Vercel project env' })
    return
  }

  const host = req.headers.host ?? 'localhost'
  const url = new URL(req.url ?? '/', `https://${host}`)
  const path = url.pathname.replace(/^\/api\/groq-proxy/, '') || '/'
  const targetUrl = `https://api.groq.com${path}${url.search}`

  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
  }
  const ct = req.headers['content-type']
  if (ct) headers['content-type'] = ct

  let body: Buffer | undefined
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    body = await readBody(req)
  }

  const r = await fetch(targetUrl, {
    method: req.method,
    headers,
    body: body && body.length > 0 ? body : undefined,
  })

  res.status(r.status)
  r.headers.forEach((value, name) => {
    if (name.toLowerCase() === 'transfer-encoding') return
    res.setHeader(name, value)
  })

  const buf = Buffer.from(await r.arrayBuffer())
  res.send(buf)
}
