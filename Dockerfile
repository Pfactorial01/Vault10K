# syntax=docker/dockerfile:1.6
FROM node:20.19.0-bookworm-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci
COPY apps/api apps/api
COPY apps/web apps/web
RUN npm run build -w apps/web && npm run build -w apps/api

FROM node:20.19.0-bookworm-slim AS runner
RUN apt-get update \
  && apt-get install -y --no-install-recommends dumb-init=1.2.5-2 \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
ENV FILINGS_DATA_DIR=/data/filings
ENV FASTEMBED_CACHE_DIR=/tmp/fastembed-cache
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --omit=dev \
  && npm install onnxruntime-node@1.21.0 --omit=dev \
  && groupadd --system vault \
  && useradd --system --gid vault --no-log-init vault \
  && mkdir -p /data/filings /tmp/fastembed-cache \
  && chown -R vault:vault /app /data /tmp/fastembed-cache
COPY --from=builder /app/apps/api/dist apps/api/dist
COPY --from=builder /app/apps/web/dist apps/web/dist
USER vault
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3001/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "apps/api/dist/index.js"]
