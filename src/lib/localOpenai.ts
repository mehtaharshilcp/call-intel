/**
 * Calls OpenAI or Groq through Vite dev proxies (`/openai` or `/groq`) so the browser
 * avoids CORS and the API key stays on the dev server (see vite.config.ts).
 * Set VITE_USE_GROQ=1 and GROQ_API_KEY to use Groq’s free tier (OpenAI-compatible API).
 */
const useGroq =
  import.meta.env.VITE_USE_GROQ === '1' || import.meta.env.VITE_USE_GROQ === 'true'

const BASE = useGroq ? '/groq/openai/v1' : '/openai/v1'

const chatModel = useGroq
  ? import.meta.env.VITE_GROQ_CHAT_MODEL || 'llama-3.1-8b-instant'
  : import.meta.env.VITE_OPENAI_CHAT_MODEL || 'gpt-4o-mini'

export async function transcribeAudio(blob: Blob, filename: string): Promise<{
  duration?: number
  segments?: Array<{ start?: number; end?: number; text?: string }>
  text?: string
}> {
  const fd = new FormData()
  fd.append('file', blob, filename || 'audio.webm')
  fd.append(
    'model',
    useGroq
      ? import.meta.env.VITE_GROQ_TRANSCRIPTION_MODEL || 'whisper-large-v3-turbo'
      : import.meta.env.VITE_OPENAI_TRANSCRIPTION_MODEL || 'whisper-1'
  )
  fd.append('response_format', 'verbose_json')
  fd.append('timestamp_granularities[]', 'segment')

  const res = await fetch(`${BASE}/audio/transcriptions`, { method: 'POST', body: fd })
  if (!res.ok) throw new Error((await res.text()) || `Transcription ${res.status}`)
  return res.json()
}

export type ChatJsonOptions = {
  /**
   * When true (default), uses `response_format: json_object`. Some providers (e.g. Groq)
   * reject the whole request if the model returns structurally invalid JSON; set false for
   * long structured outputs and parse JSON from the text instead.
   */
  jsonObject?: boolean
}

export async function chatJson(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options: ChatJsonOptions = {}
): Promise<string> {
  const jsonObject = options.jsonObject !== false
  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: chatModel,
      ...(jsonObject ? { response_format: { type: 'json_object' } } : {}),
      messages,
    }),
  })
  if (!res.ok) throw new Error((await res.text()) || `Chat ${res.status}`)
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
  return data.choices?.[0]?.message?.content ?? '{}'
}

export { chatModel }
