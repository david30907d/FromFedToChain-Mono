import '../models/episode.dart';
import '../models/episode_page.dart';
import 'supabase_service.dart';

class EpisodeService {
  EpisodeService({SupabaseService? supabaseService})
      : _supabaseService = supabaseService ?? SupabaseService();

  final SupabaseService _supabaseService;

  Future<EpisodePage> getEpisodes({int limit = 20, String? cursor}) async {
    final offset = int.tryParse(cursor ?? '') ?? 0;
    final end = offset + limit;
    final rows = await _supabaseService.client
        .from('episodes_with_stats')
        .select()
        .order('created_at', ascending: false)
        .order('id', ascending: false)
        .range(offset, end);

    final episodes = rows
        .take(limit)
        .map((row) => Episode.fromJson(row))
        .toList(growable: false);

    return EpisodePage(
      items: episodes,
      nextCursor: rows.length > limit ? '${offset + limit}' : null,
    );
  }

  Future<Set<String>> getListenedEpisodeIds(String userId) async {
    final rows = await _supabaseService.client
        .from('user_episode_state')
        .select('episode_id')
        .eq('user_id', userId)
        .eq('listened', true);

    return rows.map((row) => row['episode_id'] as String).toSet();
  }

  Future<void> setListened({
    required String userId,
    required String episodeId,
    required bool listened,
  }) async {
    await _supabaseService.client.from('user_episode_state').upsert(
      {
        'user_id': userId,
        'episode_id': episodeId,
        'listened': listened,
        'updated_at': DateTime.now().toUtc().toIso8601String(),
      },
      onConflict: 'user_id,episode_id',
    );
  }
}
