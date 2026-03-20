# CP Prompt-X — Call Intelligence (browser app)

Single **React + Vite** app. Call metadata, transcripts, analysis, and **audio** are stored in **[IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)** (via [Dexie](https://dexie.org/)). No separate database or API server.

**[Groq](https://console.groq.com/)** (Whisper-class STT + chat) is called from the browser via **`/api/transcribe`**, **`/api/chat`**, and (for large files) **`/api/blob-upload`**. In dev, **Vite proxies** the first two to `api.groq.com`; on **Vercel**, flat files under **`api/`** forward with **`GROQ_API_KEY`** (never in the client).

## Run

```bash
cp .env.example .env
# Set GROQ_API_KEY (from console.groq.com)
npm install
npm run dev
```

Open http://localhost:5173

Always run commands from the **repository root** (`Hackathon/`), not a removed `frontend/` path.

## Production (Vercel)

1. Set **`GROQ_API_KEY`** (or **`OPENAI_API_KEY`**) in **Project → Environment Variables** — server-only, not `VITE_*`.
2. **Audio up to 15MB:** Enforced in the UI/API/Blob token. **Vercel** still rejects large **multipart** requests to a single function (~4.5MB), so in production, files **over ~2MB** use **Blob upload** then transcribe via JSON `{ url }`. Configure **[Vercel Blob](https://vercel.com/docs/storage/vercel-blob)** and **`BLOB_READ_WRITE_TOKEN`**. Large files need enough **function duration** (this repo allows up to **300s** for transcription on supported plans).
3. Optional: **`VITE_GROQ_CHAT_MODEL`**, **`VITE_GROQ_TRANSCRIPTION_MODEL`** (inlined at build time).
4. [`vercel.json`](vercel.json) rewrites non-API paths to `index.html` for SPA routing and sets function timeouts.

**Folder layout** (API):

```text
api/
  _forward.ts      # shared Groq proxy (buffers request + response)
  transcribe.ts    # POST → Groq /openai/v1/audio/transcriptions (multipart or JSON { url })
  chat.ts          # POST → Groq /openai/v1/chat/completions
  blob-upload.ts   # Vercel Blob client-upload tokens (large audio on Vercel)
```

**Other static hosts:** replicate those paths or change URLs in [`src/lib/groqClient.ts`](src/lib/groqClient.ts).

## Environment

See [`.env.example`](.env.example).

## Troubleshooting

**`npm run build` → `Error: ENOENT: no such file or directory, uv_cwd`** — Your shell is still inside the old `frontend/` folder (deleted after the repo was flattened). Open a new terminal or run `cd /path/to/Hackathon` (this repo root), then `npm run build` again.

**Vercel: `NOT_FOUND` on `/api/transcribe` etc.** — Repo root = **Root Directory**; commit must include `api/*.ts`. **GET** to transcribe returns **405**; the app uses **POST**.

**`FUNCTION_INVOCATION_FAILED`** — See **Logs**. This project uses **Node** `runtime`, **flat** `api/*.ts` routes (deep nesting was unreliable), and **buffers** Groq responses. Long MP3s may **timeout** on Hobby; use a plan with longer **maxDuration** or shorter clips.
