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
cp packages/pipeline/.env.example packages/pipeline/.env
```

Fill `packages/pipeline/.env`, then run the Supabase SQL in
`packages/pipeline/supabase/schema.sql`.

## Run

Pipeline:

```bash
pnpm dev
```

The pipeline API defaults to `http://localhost:3000`.

Mobile:

```bash
cd apps/mobile
flutter pub get
flutter run --dart-define=API_BASE_URL=http://localhost:3000
```

For Android emulator, use:

```bash
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000
```

iOS simulator can usually use `http://localhost:3000`.

## API Checks

```bash
curl http://localhost:3000/health

curl -X POST http://localhost:3000/ingest \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/article"}'

curl http://localhost:3000/episodes

curl -X POST http://localhost:3000/episodes/<episode-id>/listened
```

## Mobile POC

The app reads episodes from the pipeline API, plays each episode's `audioUrl`,
and calls the pipeline API to mark episodes as listened. It does not connect
directly to Supabase.
