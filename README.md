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

## Project plan & prompt log (PDF / Word)

**Project plan** — scope, architecture, data model, API, phases, risks, success criteria:

| File | Use |
|------|-----|
| [`docs/PROJECT_PLAN.md`](docs/PROJECT_PLAN.md) | Full plan (Mermaid diagram renders in GitHub / VS Code) |
| [`docs/PROJECT_PLAN.html`](docs/PROJECT_PLAN.html) | Open in browser → **Print → Save as PDF** |

**Prompt log** — exact LLM prompts and STT parameters:

| File | Use |
|------|-----|
| [`docs/PROMPT_LOG.md`](docs/PROMPT_LOG.md) | Source in Git |
| [`docs/PROMPT_LOG.html`](docs/PROMPT_LOG.html) | Print → PDF |

**Word:** Open any `.md` in Microsoft Word and save as `.docx`, or run `pandoc docs/PROJECT_PLAN.md -o docs/PROJECT_PLAN.docx` (and similarly for `PROMPT_LOG.md`) if [Pandoc](https://pandoc.org/) is installed.

## Troubleshooting

**`npm run build` → `Error: ENOENT: no such file or directory, uv_cwd`** — Your shell’s current directory may be invalid (e.g. a deleted folder). `cd` to the repo root and run the command again.

**Transcription or chat fails with 401** — Check that **`GROQ_API_KEY`** is set in `.env` and that you restarted **`npm run dev`** after changing it.

**Large audio fails** — Confirm file size is under the limit in the UI/error message; Groq and the proxy must accept the full multipart body.
