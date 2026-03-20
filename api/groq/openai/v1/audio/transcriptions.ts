import { forwardToGroq } from '../../../_forward'

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    console.warn('[groq-transcribe] rejected method', request.method)
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return forwardToGroq(request, '/openai/v1/audio/transcriptions')
}
