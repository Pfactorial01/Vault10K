# Vault10K

Vault10K is an application for **ingesting SEC Form 10-K filings**, cleaning and chunking the text, **embedding** passages into a vector database, and **chatting** over your indexed content with retrieval-augmented generation (RAG). You trigger ingestion from the UI; the API downloads submissions, stores metadata in **MongoDB**, serves searchable **HTML** readers, and exposes a **chat** UI with per-thread filters and citation cards back to source chunks.

---

## What it does

1. **Ingestion** — For a given ticker (or CIK) and report year, the service resolves the 10-K from SEC submissions, downloads the filing, extracts primary HTML, scrubs noise with **Cheerio**, splits text into overlapping chunks, and embeds each chunk with **FastEmbed** into **Qdrant** while persisting filing metadata and chunk markers in **MongoDB**.
2. **Filing browser** — List ingested filings and open the primary 10-K HTML in a reader panel.
3. **Chat (RAG)** — Multi-session chats stored in Mongo; each message runs a RAG pipeline: optional **Redis** semantic cache for one-shot queries, vector search over chunks (with ticker/year filters and query-aware reranking), and **OpenAI** chat completion with citations. Vault-wide questions (e.g. how many filings are indexed) are answered from the database without vector noise.

---

## Repository layout

| Path | Role |
|------|------|
| `apps/api` | Express HTTP API: health, filings, ingestion jobs, tickers, `/api/ask`, `/api/chats` + messages, static production UI. |
| `apps/web` | React SPA (Vite): Dashboard (chat + reader popover), Ingestion. |
| `Dockerfile` | Multi-stage build: builds web + API, production image runs `node apps/api/dist/index.js` with `dumb-init`. |
| `docker-compose.yml` | MongoDB, Qdrant, Redis, and the `api` service (port **3001**). |

Root **`package.json`** uses **npm workspaces** (`apps/api`, `apps/web`). Scripts: `npm run build`, `npm run dev:api`, `npm run dev:web`, `npm test` (API unit tests).

---

## Tools and stack

**Languages & runtime**

- **Node.js** 20 (see `Dockerfile` base image)
- **TypeScript** across API and web

**Backend (`apps/api`)**

- **Express** — HTTP server, JSON APIs, static `apps/web/dist` in production
- **Mongoose** — MongoDB models: filings, ingestion jobs, chat conversations/messages
- **@qdrant/js-client-rest** — Vector upsert/search over embedded chunks
- **FastEmbed** — Local embedding model (configurable via `FASTEMBED_*`); **onnxruntime-node** added in Docker for inference
- **OpenAI** (`openai` SDK) — Chat completions for RAG answers
- **Cheerio** — HTML scrubbing / parsing for 10-K text
- **ioredis** — Redis client for optional semantic answer cache
- **cors**, **dotenv**, **uuid**, **entities** — Cross-origin, env loading, IDs, HTML entities
- **tsx** — Dev watch for the API; **Vitest** — unit tests (e.g. extract/scrub/chunk)

**Frontend (`apps/web`)**

- **React** 18, **React DOM**
- **React Router** — `/`, `/ingest`
- **Vite** + **@vitejs/plugin-react** — Dev server (port **5173**) with proxy of `/api` and `/health` to the API

**Data & infra (Docker Compose)**

- **MongoDB** 7 — Document store for filings, jobs, chats
- **Qdrant** 1.12 — Vector collection for chunk embeddings
- **Redis** 7 — Semantic cache (and future queue hooks)

**Container & ops**

- **Docker** / **Docker Compose** — Local and deployable full stack
- **dumb-init** — PID 1 in the API container

**CI**

- **GitHub Actions** — Workflow under `.github/workflows/` (e.g. Dockerfile lint on push/PR)

---

## Ingestion model

Jobs are stored in MongoDB with statuses such as `queued` / `processing` / `completed` / `failed`. A single in-process worker claims queued jobs and runs download → ingest → embed → upsert to Qdrant. There is no separate worker process in the MVP; scaling would add more runners or a dedicated queue later.

---

## Configuration

Copy **`.env.example`** to **`.env`** and set at least **`OPENAI_API_KEY`**. Other variables cover Mongo, Qdrant, Redis, filing storage paths, SEC user-agent, embedding model, and CORS **`WEB_ORIGIN`**.

---

## Quick start (Docker)

1. `cp .env.example .env` and set `OPENAI_API_KEY` (and adjust paths/origin if needed).
2. `docker compose up --build`
3. Open **`http://localhost:3001`** — API plus built static UI. Qdrant dashboard: **`http://localhost:6333`**.

---

## Local development

1. Start dependencies: `docker compose up mongo qdrant redis -d` (or your own instances).
2. `cp .env.example .env` — point `MONGODB_URI`, `QDRANT_URL`, `REDIS_URL`, `FILINGS_DATA_DIR` at your machine.
3. Repo root: `npm install`.
4. Two terminals: `npm run dev:api` (API on **3001**) and `npm run dev:web` (Vite on **5173**; proxies `/api` to the API).

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Build web (tsc + Vite) then API (tsc). |
| `npm run dev:api` | API with `tsx watch`. |
| `npm run dev:web` | Vite dev server. |
| `npm test` | API Vitest suite. |
