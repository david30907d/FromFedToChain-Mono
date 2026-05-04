import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'screens/auth_gate.dart';
import 'state/auth_provider.dart';
import 'state/likes_provider.dart';
import 'state/playback_provider.dart';
import 'theme/app_theme.dart';

const _supabaseUrl = String.fromEnvironment(
  'SUPABASE_URL',
  defaultValue: 'https://urplxsioxepxopuababf.supabase.co',
);
const _supabaseAnonKey = String.fromEnvironment('SUPABASE_ANON_KEY');
const _supabaseDbSchema = String.fromEnvironment(
  'SUPABASE_DB_SCHEMA',
  defaultValue: 'from_fed_to_chain',
);

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  if (_supabaseAnonKey.isNotEmpty) {
    await Supabase.initialize(
      url: _supabaseUrl,
      anonKey: _supabaseAnonKey,
      postgrestOptions: PostgrestClientOptions(schema: _supabaseDbSchema),
    );
  }

  runApp(
    AiPodcastApp(supabaseConfigured: _supabaseAnonKey.isNotEmpty),
  );
}

class AiPodcastApp extends StatelessWidget {
  const AiPodcastApp({
    super.key,
    this.supabaseConfigured = true,
  });

  final bool supabaseConfigured;

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => PlaybackProvider()),
        ChangeNotifierProvider(create: (_) => LikesProvider()),
      ],
      child: MaterialApp(
        title: 'From Fed to Chain',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.dark(),
        home: AuthGate(supabaseConfigured: supabaseConfigured),
      ),
    );
  }
}
