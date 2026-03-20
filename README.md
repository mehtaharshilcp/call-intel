# CP Prompt-X — Call Intelligence (browser app)

Single **React + Vite** app. Call metadata, transcripts, analysis, and **audio** are stored in **[IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)** (via [Dexie](https://dexie.org/)). No separate database server.

**[Groq](https://console.groq.com/)** (Whisper-class STT + chat) is used from the app through **`/api/transcribe`** and **`/api/chat`**. Locally, **Vite proxies** those paths to `api.groq.com` and adds **`Authorization`** from **`GROQ_API_KEY`** in `.env` (the key is never bundled into client JS).

## Run locally

Prerequisites: **Node.js 20+** (or current LTS) and npm.

```bash
cd "/path/to/Hackathon"   # repo root
cp .env.example .env
```

Create or edit **`.env`** in the repo root. Example (same as [`.env.example`](.env.example)):

```env
# Required for local dev (Vite proxy). Get a key at https://console.groq.com/keys — never commit real keys.
GROQ_API_KEY=

# Groq chat + Whisper-class STT (optional overrides)
VITE_GROQ_CHAT_MODEL=llama-3.1-8b-instant
VITE_GROQ_TRANSCRIPTION_MODEL=whisper-large-v3-turbo
```

| Variable | Required | Description |
|----------|----------|-------------|
| `GROQ_API_KEY` | **Yes** (for dev proxy) | API key from [Groq Console → API keys](https://console.groq.com/keys). Paste after the `=` with no quotes. |
| `VITE_GROQ_CHAT_MODEL` | No | Chat completion model id (inlined at build time; default if unset: `llama-3.1-8b-instant`). |
| `VITE_GROQ_TRANSCRIPTION_MODEL` | No | Audio transcription model id (default if unset: `whisper-large-v3-turbo`). |

Then:

```bash
npm install
npm run dev
```

Open **http://localhost:5173**

### Other commands

| Command            | Purpose                          |
|--------------------|----------------------------------|
| `npm run build`    | Typecheck + production build to `dist/` |
| `npm run preview`  | Serve `dist/` locally          |
| `npm run lint`     | ESLint                          |

### How API calls work in dev

[`vite.config.ts`](vite.config.ts) maps:

- `/api/transcribe` → `https://api.groq.com/openai/v1/audio/transcriptions`
- `/api/chat` → `https://api.groq.com/openai/v1/chat/completions`

and injects `Authorization: Bearer <GROQ_API_KEY>` on the proxied request.

Audio uploads use **multipart/form-data** up to **15MB** (see [`src/lib/groqClient.ts`](src/lib/groqClient.ts)). If a host limits request body size, use shorter clips or a smaller bitrate.

### Optional: `api/` folder

The [`api/`](api/) TypeScript files are **Groq proxy handlers** you can run behind any Node HTTP server or adapter that supports the same request/response shape (they are **not** started by `npm run dev`). For day-to-day development, the Vite proxy is enough.

## Troubleshooting

**`npm run build` → `Error: ENOENT: no such file or directory, uv_cwd`** — Your shell’s current directory may be invalid (e.g. a deleted folder). `cd` to the repo root and run the command again.

**Transcription or chat fails with 401** — Check that **`GROQ_API_KEY`** is set in `.env` and that you restarted **`npm run dev`** after changing it.

**Large audio fails** — Confirm file size is under the limit in the UI/error message; Groq and the proxy must accept the full multipart body.
