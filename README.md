# Vault10K

MERN stack for SEC 10-K ingestion (UI-triggered), scrub/chunk/embed, MongoDB + Qdrant RAG, optional Redis semantic cache.

## Quick start (Docker)

1. Copy `cp .env.example .env` and set `OPENAI_API_KEY`.
2. `docker compose up --build`
3. Open `http://localhost:3001` (API + static UI). Qdrant dashboard: `http://localhost:6333`.

## Local development

1. Start MongoDB, Qdrant, Redis (e.g. `docker compose up mongo qdrant redis -d`).
2. `cp .env.example .env` — point `MONGODB_URI`, `QDRANT_URL`, `REDIS_URL`, `FILINGS_DATA_DIR` at localhost paths.
3. `npm install` at repo root.
4. `npm run dev:api` and `npm run dev:web` (Vite proxies `/api` to `localhost:3001`).

## Ingestion jobs

Single-worker **in-process** queue: MongoDB `IngestionJob` documents with status `queued` are claimed by `enqueueProcessNext()` after POST. No BullMQ in MVP; Redis is used for semantic cache and can back a queue later.

## Dockerfiles

[dockerfile-roast](https://github.com/immanuwell/dockerfile-roast) (`droast`) is run in CI (`.github/workflows/lint-dockerfiles.yml`). Local: `docker run --rm -v "$PWD":/work:ro ghcr.io/immanuwell/droast:latest /work/Dockerfile -s warning`.

## Git and GitHub

- **Tracked:** source, `package-lock.json`, `.env.example`, `.github/`, `Dockerfile`, `docker-compose.yml`.
- **Never commit:** `.env` (secrets), `node_modules/`, `**/dist/`, local `data/` (downloaded filings), IDE folders (`.vscode/`, `.cursor/`, etc.). These are listed in `.gitignore`.
- **First push:** `git init`, `git add -A`, `git status` (confirm `.env` is absent), then `git commit`, add a remote, `git push -u origin main` (use your branch name if different).
