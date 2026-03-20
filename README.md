# CP Prompt-X — Call Intelligence (browser app)

Single **React + Vite** app. Call metadata, transcripts, analysis, and **audio** are stored in **[IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)** (via [Dexie](https://dexie.org/)). No separate database or API server.

**[Groq](https://console.groq.com/)** (Whisper-class STT + chat via an OpenAI-compatible HTTP API) is called from the browser as **`/api/groq/openai/v1/...`**. In dev, **Vite proxies** that path to Groq and injects the key; on **Vercel**, **serverless routes** under `api/groq/` forward the request with **`GROQ_API_KEY`** (never exposed to the client). Groq’s **free tier** is enough for demos.

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
  blob/upload.ts                       # Vercel Blob client-upload tokens (large audio)
  groq/
    _forward.ts
    openai/v1/audio/transcriptions.ts  # multipart proxy OR JSON { url } after Blob
    openai/v1/chat/completions.ts
```

**Other static hosts:** you must replicate the same `/api/groq/...` forwarding (or change `BASE` in [`src/lib/groqClient.ts`](src/lib/groqClient.ts)) with a server or edge function; `vite build` alone is not enough.

## Environment

See [`.env.example`](.env.example).

## Troubleshooting

**`npm run build` → `Error: ENOENT: no such file or directory, uv_cwd`** — Your shell is still inside the old `frontend/` folder (deleted after the repo was flattened). Open a new terminal or run `cd /path/to/Hackathon` (this repo root), then `npm run build` again.

**Vercel: `NOT_FOUND` on `/api/groq/...`** — Use the repo root as **Root Directory**, redeploy after adding env vars, and ensure `api/groq/**` is in the deployment. A browser **GET** to the transcriptions URL returns **405** once routing works; **POST** + multipart is required for real transcription.

**`FUNCTION_INVOCATION_FAILED`** — Often fixed by using **Node.js** for API routes and **buffering** the request body (this repo does both). Check **Vercel → Logs** for the real stack trace. Long MP3s may also **timeout** on the Hobby limit (~10s execution): use **Pro** or shorter audio so transcription + analysis can finish.
