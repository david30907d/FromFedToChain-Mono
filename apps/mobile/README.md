# Mobile POC

Minimal Flutter app for the AI Podcast POC.

The POC currently keeps data access behind `packages/pipeline`; mobile should call
the pipeline API instead of connecting directly to Supabase.

## Run

```bash
flutter pub get
flutter run
```

The app defaults to `https://from-fed-to-chain-api.fly.dev/`. Override
`API_BASE_URL` only for local development:

```bash
flutter run --dart-define=API_BASE_URL=http://localhost:3010
```

Use `http://10.0.2.2:3000` for Android emulator.
