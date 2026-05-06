import '../models/episode.dart';
import '../models/episode_page.dart';
import '../config/app_config.dart';
import 'supabase_service.dart';

class UserEpisodeState {
  const UserEpisodeState({
    required this.listened,
    required this.lastPositionSeconds,
  });

  final bool listened;
  final int lastPositionSeconds;
}

class EpisodeService {
  EpisodeService({SupabaseService? supabaseService})
      : _supabaseService = supabaseService ?? SupabaseService();

  final SupabaseService _supabaseService;

  Future<EpisodePage> getEpisodes({
    int limit = 20,
    String? cursor,
    String languageCode = AppConfig.contentLanguageCode,
  }) async {
    final offset = int.tryParse(cursor ?? '') ?? 0;
    final end = offset + limit;
    final rows = await _supabaseService.client
        .from('episodes_with_stats')
        .select(
          'id,localization_id,title,language_code,hls_url,created_at,listened,script,like_count,language_classrooms',
        )
        .eq('language_code', languageCode)
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

  Future<Map<String, UserEpisodeState>> getUserState(
    String userId, {
    Iterable<String>? episodeIds,
  }) async {
    final ids = episodeIds?.toSet().toList(growable: false);
    if (ids != null && ids.isEmpty) return const {};

    var query = _supabaseService.client
        .from('user_episode_state')
        .select('episode_id,listened,last_position_seconds')
        .eq('user_id', userId);

    if (ids != null) {
      query = query.inFilter('episode_id', ids);
    }

    final rows = await query;
    return {
      for (final row in rows)
        row['episode_id'] as String: UserEpisodeState(
          listened: row['listened'] as bool? ?? false,
          lastPositionSeconds: _readStateSeconds(row),
        ),
    };
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

  Future<void> setPosition({
    required String userId,
    required String episodeId,
    required int seconds,
  }) async {
    await _supabaseService.client.from('user_episode_state').upsert(
      {
        'user_id': userId,
        'episode_id': episodeId,
        'last_position_seconds': seconds,
        'updated_at': DateTime.now().toUtc().toIso8601String(),
      },
      onConflict: 'user_id,episode_id',
    );
  }
}

int _readStateSeconds(Map<String, dynamic> row) {
  final value = row['last_position_seconds'] ?? row['lastPositionSeconds'];
  if (value is int) return value;
  if (value is num) return value.toInt();
  return int.tryParse(value?.toString() ?? '') ?? 0;
}
