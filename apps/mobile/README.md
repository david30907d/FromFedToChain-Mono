# Mobile POC

Polished Flutter podcast player for the AI Podcast POC.

The app reads episodes, likes, and listened state directly from Supabase. The
pipeline package remains responsible for ingest and audio generation.

## Run

```bash
flutter pub get
flutter run \
  --dart-define=SUPABASE_URL=https://urplxsioxepxopuababf.supabase.co \
  --dart-define=SUPABASE_ANON_KEY=<anon-key> \
  --dart-define=SUPABASE_DB_SCHEMA=from_fed_to_chain
```

Supabase Data API must expose `from_fed_to_chain`; otherwise the mobile client
will get schema-cache errors even though the tables exist in SQL.

`API_BASE_URL` is only needed for legacy API-service tests or local experiments:

```bash
flutter run --dart-define=API_BASE_URL=http://localhost:3010
```

Use `http://10.0.2.2:3000` for Android emulator.
