# Mobile POC

Minimal Flutter app for the AI Podcast POC.

The POC currently keeps data access behind `packages/pipeline`; mobile should call
the pipeline API instead of connecting directly to Supabase.

## Run

```bash
flutter pub get
flutter run --dart-define=API_BASE_URL=http://localhost:3000
```

Use `http://10.0.2.2:3000` for Android emulator.
