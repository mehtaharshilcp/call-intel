# CP Prompt-X — Call Intelligence (browser app)

Single **React + Vite** app. Call metadata, transcripts, analysis, and **audio** are stored in **[IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)** (via [Dexie](https://dexie.org/)). No separate database or API server.

**[Groq](https://console.groq.com/)** (Whisper-class STT + chat via an OpenAI-compatible HTTP API) is reached through a **Vite dev proxy** so the browser is not blocked by CORS and **`GROQ_API_KEY` is not** bundled into client JS. Groq’s **free tier** is enough for local development and demos.

## Run

```bash
cp .env.example .env
# Set GROQ_API_KEY (from console.groq.com)
npm install
npm run dev
```

Open http://localhost:5173

Always run commands from the **repository root** (`Hackathon/`), not a removed `frontend/` path.

## Production

**Vercel:** set **`GROQ_API_KEY`** in Project → Settings → Environment Variables (not `VITE_*`). The repo includes [`vercel.json`](vercel.json) and [`api/groq-proxy/[...path].ts`](api/groq-proxy/[...path].ts) so `/groq/...` is proxied to `https://api.groq.com/...` with that key — same paths as in dev.

**Other static hosts:** `vite build` has no dev proxy; you need a small server or edge function that forwards to `https://api.groq.com` with `Authorization: Bearer <GROQ_API_KEY>`.

## Environment

See [`.env.example`](.env.example).

## Troubleshooting

**`npm run build` → `Error: ENOENT: no such file or directory, uv_cwd`** — Your shell is still inside the old `frontend/` folder (deleted after the repo was flattened). Open a new terminal or run `cd /path/to/Hackathon` (this repo root), then `npm run build` again.
