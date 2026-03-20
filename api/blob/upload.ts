import { handleUpload } from '@vercel/blob/client'
import type { HandleUploadBody } from '@vercel/blob/client'

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body: HandleUploadBody
  try {
    body = (await request.json()) as HandleUploadBody
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('[blob/upload] BLOB_READ_WRITE_TOKEN is not set')
    return new Response(
      JSON.stringify({
        error:
          'Vercel Blob is not configured. Add a Blob store and set BLOB_READ_WRITE_TOKEN (see README).',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  try {
    const result = await handleUpload({
      body,
      request,
      token: process.env.BLOB_READ_WRITE_TOKEN,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: [
          'audio/webm',
          'audio/wav',
          'audio/wave',
          'audio/x-wav',
          'audio/mp4',
          'audio/mpeg',
          'audio/mp3',
          'audio/x-m4a',
          'application/octet-stream',
        ],
        maximumSizeInBytes: 100 * 1024 * 1024,
      }),
    })
    return Response.json(result)
  } catch (e) {
    console.error('[blob/upload]', e)
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
