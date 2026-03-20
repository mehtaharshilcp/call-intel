import { forwardToGroq } from './_forward'

export default async function handler(request: Request): Promise<Response> {
  try {
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const ct = request.headers.get('content-type') || ''
    if (ct.includes('application/json')) {
      return new Response(
        JSON.stringify({
          error:
            'Transcription expects multipart/form-data with an audio file. JSON body uploads are not supported.',
        }),
        { status: 415, headers: { 'Content-Type': 'application/json' } }
      )
    }

    return forwardToGroq(request, '/openai/v1/audio/transcriptions')
  } catch (e) {
    console.error('[transcribe] unhandled', e)
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Invocation failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
