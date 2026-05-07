# Pipeline API

Hono HTTP server for article ingest, script generation, TTS, HLS packaging, and
episode listing.

## Telegram Bot Setup

Create a bot with [BotFather](https://t.me/BotFather), then set these env vars
for the pipeline process:

```bash
TELEGRAM_BOT_TOKEN=123456789:your-bot-token
TELEGRAM_WEBHOOK_SECRET=replace-with-a-long-random-secret
TELEGRAM_ALLOWED_USER_IDS=123456789
```

Use [@userinfobot](https://t.me/userinfobot) to find your Telegram user ID.
`TELEGRAM_ALLOWED_USER_IDS` is a comma-separated allowlist.

For local end-to-end testing:

```bash
pnpm --dir packages/pipeline dev
ngrok http 3000
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -d "url=https://your-ngrok-host.ngrok-free.app/telegram/webhook" \
  -d "secret_token=$TELEGRAM_WEBHOOK_SECRET"
```

For production:

```bash
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -d "url=https://from-fed-to-chain-api.fly.dev/telegram/webhook" \
  -d "secret_token=$TELEGRAM_WEBHOOK_SECRET"

curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo"
```

The webhook returns a fast 200 ack, then runs ingest in the background. The
current Fly configuration keeps `min_machines_running = 0`; if Fly stops a
machine mid-ingest, the next submission of the same URL resumes from the latest
Supabase-committed stage.
