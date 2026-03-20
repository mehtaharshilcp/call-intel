import { forwardToGroq } from './_forward'

export default async function handler(request: Request): Promise<Response> {
  try {
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return forwardToGroq(request, '/openai/v1/chat/completions')
  } catch (e) {
    console.error('[chat] unhandled', e)
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Invocation failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
