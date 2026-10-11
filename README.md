# 🎙️ VoxScribe AI

VoxScribe AI is a full-stack, multi-agent AI platform that turns YouTube videos, web articles and podcasts into blog posts, X threads, LinkedIn posts, newsletters and show notes written in your exact personal or brand voice, using Retrieval-Augmented Generation (RAG).

---

## 🏗️ Project Architecture & Directory Structure

VoxScribe is a monorepo with a **Next.js 16 (App Router)** frontend and a **FastAPI (Python)** multi-agent backend powered by **LangGraph**, **Groq** (Llama models + Whisper) and **Supabase (pgvector)**.

```
VoxScribe/
├── package.json                   # Monorepo scripts (dev, test, build)
├── docker-compose.yml             # Full stack in containers
├── .env.example                   # Environment variable template
├── .github/workflows/ci.yml       # CI: backend tests, frontend typecheck/test/lint/build
├── supabase/
│   └── schema.sql                 # Tables, RLS policies, pgvector index, match_documents RPC (idempotent)
├── voxscribe-app/                 # Next.js frontend
│   ├── app/page.tsx               # Dashboard (vault, generation, history)
│   ├── components/dashboard/      # BrandVault, GeneratePost, Progress, OutlineReview, ResultViewer, SEO, Publish, History
│   ├── components/layout/         # Sidebar (with usage meter) & mobile nav
│   ├── hooks/                     # useVoices, useAccount
│   ├── lib/                       # api (fetch + SSE), export, markdown, formats
│   ├── tests/                     # Vitest unit tests
│   └── Dockerfile
└── voxscribe-backend/             # FastAPI backend
    ├── app/
    │   ├── agents/                # LangGraph: researcher → writer ⇄ reviewer → editor
    │   ├── api/endpoints/         # generate, vault, voices, posts, publish, meta, health
    │   ├── core/                  # auth (Supabase JWT), llm, embeddings, rate_limit
    │   ├── services/              # sources, transcription, vault, SEO, publishing, exports, caching
    │   └── schemas/               # Pydantic models
    ├── tests/                     # pytest suite (in-memory Supabase/LLM fakes)
    └── Dockerfile
```

### Agent pipeline

```
researcher ──▶ writer ──▶ reviewer ──▶ editor ──▶ END
   │             ▲            │
   │             └─ revision ─┘   (once, if the review score is below 7/10)
   └─ optional pause here for the user to edit the outline
```

---

## ✨ Features

### Generation
- **Multiple sources:** YouTube (captions, with a Whisper fallback for videos without them), web articles, and uploaded audio (MP3/M4A/WAV/…, transcribed with Groq Whisper).
- **Output formats:** blog post, X thread, LinkedIn post, newsletter, and show notes with timestamped chapters.
- **Controls:** length, tone, target audience, language, SEO keyword and AI model.
- **Outline review:** optionally pause after the Researcher, edit the outline, then continue.
- **Reviewer agent:** scores voice match and coverage, and sends weak drafts back to the Writer once.
- **Live progress:** real per-agent progress over Server-Sent Events (with keep-alive heartbeats).

### Brand Voice Vault
- **Multiple voices** (e.g. "Personal blog" vs "Company blog").
- **Samples from PDF, DOCX, TXT, MD, pasted text, or a URL** to one of your published articles.
- **Manage samples:** list, see chunk counts, delete.
- **Style profile:** an LLM-written summary of each voice's tone and habits, refreshed automatically and used alongside RAG samples.

### Editing & publishing
- **History:** search, open, edit and delete past posts.
- **In-app editor:** Markdown editing with live preview, plus **AI rewrite of any selected passage** in your voice.
- **Export:** Markdown, HTML, PDF (print) and Word (.docx).
- **SEO panel:** meta description, slug, tags, readability score, reading time, and internal-link suggestions to your earlier posts.
- **Publish as a draft (or live)** to **Dev.to, WordPress, Ghost and Hashnode**. Credentials are used per request and never stored on the server (optionally remembered in your browser).
- **Cover image** from the source video's thumbnail.

### Platform
- **Supabase Auth** end to end: the backend verifies the user's JWT, and Row Level Security protects every table.
- **Per-user quotas & rate limits** (daily generation limit plus per-endpoint limits), with a usage meter in the sidebar.
- **Transcript caching** so the same video is never fetched or transcribed twice.
- **Tests & CI:** pytest (41 tests) and Vitest, run by GitHub Actions along with typecheck, lint and build.
- **Docker Compose** for running the full stack.

---

## 🛠️ Tech Stack

| Domain | Tech Stack |
| :--- | :--- |
| **Frontend** | Next.js 16 (App Router), React 19, Tailwind CSS, Lucide Icons, Supabase JS, react-markdown, marked |
| **Backend** | FastAPI (Python 3.10+), LangGraph, LangChain, Groq (Llama chat models + Whisper), PyMuPDF, python-docx, BeautifulSoup, yt-dlp, YouTube Transcript API |
| **Database & RAG** | Supabase PostgreSQL, `pgvector`, `all-MiniLM-L6-v2` embeddings (local via fastembed, or HuggingFace Inference API) |

---

## 🚀 Getting Started & Setup

### 1. Prerequisites

- **Node.js** v20 or later
- **Python** 3.10 – 3.12
- **Supabase project** with `pgvector` available
- **API keys:** Groq API key (a HuggingFace token is optional; embeddings run locally by default)

### 2. Environment Setup

Copy `.env.example` into `voxscribe-backend/.env` and `voxscribe-app/.env.local`:

#### Backend (`voxscribe-backend/.env`)
```env
SUPABASE_URL=https://your-supabase-project.supabase.co
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
GROQ_API_KEY=gsk_your_groq_api_key
HUGGINGFACE_API_KEY=hf_your_huggingface_api_token   # only needed if EMBEDDINGS_PROVIDER=huggingface

# Optional
EMBEDDINGS_PROVIDER=local                                         # local (free, on-device) | huggingface
AVAILABLE_MODELS=openai/gpt-oss-20b,openai/gpt-oss-120b,qwen/qwen3.8-27b   # first is the default
DAILY_GENERATION_LIMIT=25                                         # 0 = unlimited
ENABLE_WHISPER_FALLBACK=true
CORS_ORIGINS=http://localhost:3000                                # empty = allow any origin
```

#### Frontend (`voxscribe-app/.env.local`)
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-supabase-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 3. Database Initialization

Run `supabase/schema.sql` in the Supabase SQL Editor. The script is **idempotent**, so re-run it after pulling updates. It:
1. Enables `pgvector`.
2. Creates `voices`, `vault_sources`, `documents`, `blog_posts` and `transcripts`.
3. Migrates existing writing samples into a "Default" voice.
4. Registers the `match_documents` RPC (callable only by the service role).
5. Enables Row Level Security with per-user policies.

### 4. Installation & Running

#### Quickstart
```bash
npm install
npm run dev        # starts backend (port 8000) and frontend (port 3000)
```
> The backend command uses `python`, so activate the backend virtualenv first.

#### Manual Startup

**Backend:**
```bash
cd voxscribe-backend
python -m venv .venv
.venv\Scripts\activate          # Windows
source .venv/bin/activate       # Mac/Linux
pip install -r requirements.txt
python main.py
```
> API runs at `http://127.0.0.1:8000` (interactive docs at `/docs`).

**Frontend:**
```bash
cd voxscribe-app
npm install
npm run dev
```
> Web app runs at `http://localhost:3000`.

#### Docker
```bash
# Put NEXT_PUBLIC_* values in a root .env file (or export them), then:
docker compose up --build
```

### 5. Tests

```bash
npm test                         # both suites
cd voxscribe-backend && pip install -r requirements-dev.txt && python -m pytest -q
cd voxscribe-app && npm test     # Vitest
```

---

## 🔌 API Reference

All endpoints except `GET /` and `GET /models` require `Authorization: Bearer <Supabase access token>`.

| Method & path | Description |
| :--- | :--- |
| `GET /` | Health check |
| `GET /models` | Available AI models |
| `GET /usage` | Quota and content stats for the current user |
| `GET /voices` · `POST /voices` | List (creates "Default" on first use) / create voices |
| `PATCH /voices/{id}` · `DELETE /voices/{id}` | Rename / delete a voice (and its samples) |
| `POST /voices/{id}/profile` | Regenerate a voice's style profile |
| `POST /vault/upload` | Multipart `file` (PDF/DOCX/TXT/MD) + optional `voice_id` |
| `POST /vault/text` · `POST /vault/url` | Add pasted text / import an article URL |
| `GET /vault/sources` · `DELETE /vault/sources/{id}` | List / delete writing samples |
| `POST /generate/stream` | Generate with SSE progress (see below) |
| `POST /generate/resume` | Continue a run paused for outline review |
| `POST /generate` | Non-streaming generation |
| `POST /generate/transcribe` | Transcribe an audio file for use as a source |
| `POST /posts/rewrite` | Rewrite a passage in the user's voice |
| `POST /posts/seo` | SEO metadata, readability and internal links |
| `POST /posts/export/docx` | Markdown → Word document |
| `POST /publish/{devto\|wordpress\|ghost\|hashnode}` | Publish (draft by default) |

### Generation request
```json
{
  "source_type": "youtube",
  "source_url": "https://www.youtube.com/watch?v=EXAMPLE",
  "voice_id": "optional-voice-uuid",
  "options": {
    "output_format": "blog",
    "length": "medium",
    "tone": "Conversational",
    "audience": "early-stage founders",
    "language": "English",
    "keyword": "remote work",
    "model": "openai/gpt-oss-120b"
  },
  "review_outline": false
}
```
For audio, call `/generate/transcribe` first, then send `"source_type": "text"` with the returned `transcript`, `timestamped_transcript` and a `source_label`.

### Stream events
`started` → `progress` (one per agent; `writer` includes `voice_samples`, `reviewer` includes `score`) → `result` (`blog_post`, `post_id`) or `error`. With `review_outline: true` the stream ends with `outline` (`thread_id`, `outline`); send both to `/generate/resume`.

---

## 📦 Deployment notes

- Set `CORS_ORIGINS` to your frontend's origin in production.
- Rate limits and paused outline-review sessions are kept **in memory per process**. Run a single backend instance, or move them to Redis before scaling out.
- The Whisper fallback needs outbound access to YouTube; set `ENABLE_WHISPER_FALLBACK=false` to disable it.
