# CP Prompt-X — Call Intelligence (browser app)

Single **React + Vite** app. Call metadata, transcripts, analysis, and **audio** are stored in **[IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)** (via [Dexie](https://dexie.org/)). No separate database or API server.

**OpenAI** or **[Groq](https://console.groq.com/)** (both OpenAI-compatible: Whisper-class STT + chat) are reached through **Vite dev proxies** so the browser is not blocked by CORS and API keys are **not** bundled into client JS. Groq’s **free tier** is enough for local development and demos when you set `VITE_USE_GROQ=1` and `GROQ_API_KEY`.

## Run

```bash
cp .env.example .env
# Either: set OPENAI_API_KEY, or use Groq: VITE_USE_GROQ=1 and GROQ_API_KEY (free tier at console.groq.com)
npm install
npm run dev
```

Open http://localhost:5173

Always run commands from the **repository root** (`Hackathon/`), not a removed `frontend/` path.

## Production

`vite build` outputs static files without the dev proxies. For a static host you need a small edge proxy that forwards to `https://api.openai.com` or `https://api.groq.com` with the right `Authorization: Bearer …` header.

## Environment

See [`.env.example`](.env.example).

## Troubleshooting

**`npm run build` → `Error: ENOENT: no such file or directory, uv_cwd`** — Your shell is still inside the old `frontend/` folder (deleted after the repo was flattened). Open a new terminal or run `cd /path/to/Hackathon` (this repo root), then `npm run build` again.
