/**
 * Groq (OpenAI-compatible) from the browser:
 * Vite proxies `/api/transcribe` and `/api/chat` → `api.groq.com` (see `vite.config.ts`).
 * Never put the API key in the client; use `GROQ_API_KEY` for the dev proxy only.
 */
const TRANSCRIBE_URL = '/api/transcribe'
const CHAT_URL = '/api/chat'

const chatModel = import.meta.env.VITE_GROQ_CHAT_MODEL || 'llama-3.1-8b-instant'
const transcriptionModel =
  import.meta.env.VITE_GROQ_TRANSCRIPTION_MODEL || 'whisper-large-v3-turbo'

/** Hard cap for uploads (aligned with Groq usage in this app). */
export const MAX_AUDIO_BYTES = 15 * 1024 * 1024

export async function transcribeAudio(blob: Blob, filename: string): Promise<{
  duration?: number
  segments?: Array<{ start?: number; end?: number; text?: string }>
  text?: string
}> {
  if (blob.size > MAX_AUDIO_BYTES) {
    throw new Error(`Audio is too large (max ${MAX_AUDIO_BYTES / 1024 / 1024}MB). Trim or compress the file.`)
  }

  const fd = new FormData()
  fd.append('file', blob, filename || 'audio.webm')
  fd.append('model', transcriptionModel)
  fd.append('response_format', 'verbose_json')
  fd.append('timestamp_granularities[]', 'segment')

  const res = await fetch(TRANSCRIBE_URL, { method: 'POST', body: fd })
  if (!res.ok) throw new Error((await res.text()) || `Transcription ${res.status}`)
  return res.json()
}

export type ChatJsonOptions = {
  /**
   * When true (default), uses `response_format: json_object`. Groq may reject the request
   * if the model returns structurally invalid JSON; set false for long structured outputs.
   */
  jsonObject?: boolean
}

export async function chatJson(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options: ChatJsonOptions = {}
): Promise<string> {
  const jsonObject = options.jsonObject !== false
  const res = await fetch(CHAT_URL, {
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
