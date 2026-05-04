# AI Podcast POC

Minimal Turborepo monorepo for generating podcast MP3 episodes from article URLs.

## Structure

```text
apps/
  mobile/              Flutter POC player app
packages/
  pipeline/            Hono + TypeScript API
```

## Setup

```bash
pnpm install
cp .env.example .env
```

Fill `.env`, then run the Supabase SQL in
`packages/pipeline/supabase/schema.sql`.
The app schema defaults to `from_fed_to_chain`; keep `SUPABASE_DB_SCHEMA`
set to that value unless you intentionally create a separate environment.
Supabase Data API must also expose `from_fed_to_chain` in API settings, or via
the `authenticator` role `pgrst.db_schemas` setting.

## Run

Pipeline:

```bash
PORT=3010 pnpm --filter @from-fed-to-chain-mono/pipeline dev
```

The pipeline API defaults to `http://localhost:3000`.

Mobile:

See [apps/mobile/README.md](apps/mobile/README.md). The mobile app has its own
runbook there for command-line launches, Xcode launches, simulator recovery,
and optional `--dart-define` overrides. Keep mobile launch commands in that file so
they do not drift between README files.

## API Checks

```bash
curl http://localhost:3000/
curl http://localhost:3000/health

curl -X POST http://localhost:3000/ingest \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $INGEST_ADMIN_TOKEN" \
  -d '{"url":"https://example.com/article"}'

curl http://localhost:3000/episodes

curl -X POST http://localhost:3000/episodes/<episode-id>/listened
```

## Mobile App

The Flutter app reads episodes, likes, and listened state directly from
Supabase. The pipeline remains the writer for ingest, script generation, audio,
and HLS asset publishing. Mobile setup and launch instructions live in
[apps/mobile/README.md](apps/mobile/README.md).

## Fly.io Deployment

The production API is configured for Fly at `https://from-fed-to-chain-api.fly.dev`.
Cloudflare remains the R2 host for generated HLS assets.

```bash
fly launch --name from-fed-to-chain-api --region nrt --no-deploy
fly secrets set \
  NODE_ENV=production \
  SUPABASE_URL=... \
  SUPABASE_SERVICE_ROLE_KEY=... \
  R2_ENDPOINT=... \
  R2_ACCESS_KEY_ID=... \
  R2_SECRET_ACCESS_KEY=... \
  R2_BUCKET_NAME=... \
  R2_PUBLIC_BASE_URL=... \
  GOOGLE_APPLICATION_CREDENTIALS_BASE64="$(base64 -i service-account.json)" \
  OPENROUTER_API_KEY=... \
  OPENROUTER_BASE_URL=https://openrouter.ai/api/v1 \
  LLM_MODEL=anthropic/claude-3-5-sonnet-20241022 \
  INGEST_ADMIN_TOKEN=...
fly deploy
```

Smoke checks:

```bash
curl https://from-fed-to-chain-api.fly.dev/health
curl https://from-fed-to-chain-api.fly.dev/episodes
curl -i -X POST https://from-fed-to-chain-api.fly.dev/ingest \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/article"}'
curl -i -X POST https://from-fed-to-chain-api.fly.dev/ingest \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $INGEST_ADMIN_TOKEN" \
  -d '{"url":"https://example.com/article"}'
```

Build and run the mobile app from [apps/mobile](apps/mobile); see the mobile
runbook for the exact command-line and Xcode flows.
