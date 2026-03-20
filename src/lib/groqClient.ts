/**
 * Groq (OpenAI-compatible) from the browser:
 * - Dev: Vite proxies `/api/transcribe` and `/api/chat` → `api.groq.com` (see `vite.config.ts`).
 * - Prod: flat serverless routes `api/transcribe.ts`, `api/chat.ts`, `api/blob-upload.ts`.
 * Never put the API key in the client; it lives in `GROQ_API_KEY` on the server only.
 */
const TRANSCRIBE_URL = '/api/transcribe'
const CHAT_URL = '/api/chat'

const chatModel = import.meta.env.VITE_GROQ_CHAT_MODEL || 'llama-3.1-8b-instant'
const transcriptionModel =
  import.meta.env.VITE_GROQ_TRANSCRIPTION_MODEL || 'whisper-large-v3-turbo'

/** Hard cap for uploads (aligned with Vercel Blob token and Groq proxy validation). */
export const MAX_AUDIO_BYTES = 15 * 1024 * 1024

/**
 * Vercel serverless rejects large multipart bodies (~4.5 MiB). Above this size in production,
 * upload to Vercel Blob first, then POST JSON `{ url }` to transcribe.
 */
const VERCEL_DIRECT_UPLOAD_MAX_BYTES = 2 * 1024 * 1024

async function transcribeViaBlobThenJson(blob: Blob, filename: string): Promise<{
  duration?: number
  segments?: Array<{ start?: number; end?: number; text?: string }>
  text?: string
}> {
  const { upload } = await import('@vercel/blob/client')
  let uploaded
  try {
    uploaded = await upload(filename || 'audio.webm', blob, {
      access: 'public',
      handleUploadUrl: '/api/blob-upload',
      multipart: blob.size > 512 * 1024,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(
      `Upload to storage failed (${msg}). On Vercel, add a Blob store and BLOB_READ_WRITE_TOKEN for files over ~2MB (up to ${MAX_AUDIO_BYTES / 1024 / 1024}MB). See README.`
    )
  }

  const res = await fetch(TRANSCRIBE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: uploaded.url,
      filename: filename || 'audio.webm',
      model: transcriptionModel,
    }),
  })
  if (!res.ok) throw new Error((await res.text()) || `Transcription ${res.status}`)
  return res.json()
}

export async function transcribeAudio(blob: Blob, filename: string): Promise<{
  duration?: number
  segments?: Array<{ start?: number; end?: number; text?: string }>
  text?: string
}> {
  if (blob.size > MAX_AUDIO_BYTES) {
    throw new Error(`Audio is too large (max ${MAX_AUDIO_BYTES / 1024 / 1024}MB). Trim or compress the file.`)
  }

  const useBlobPath = import.meta.env.PROD && blob.size > VERCEL_DIRECT_UPLOAD_MAX_BYTES

  if (useBlobPath) {
    return transcribeViaBlobThenJson(blob, filename)
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
