import 'supabase_service.dart';

class LikeSnapshot {
  const LikeSnapshot({
    required this.likedEpisodeIds,
    required this.counts,
  });

  final Set<String> likedEpisodeIds;
  final Map<String, int> counts;
}

class LikesService {
  LikesService({SupabaseService? supabaseService})
      : _supabaseService = supabaseService ?? SupabaseService();

  final SupabaseService _supabaseService;

  Stream<LikeSnapshot> streamLikeSnapshot(String userId) {
    return _supabaseService.client
        .from('likes')
        .stream(primaryKey: ['user_id', 'episode_id']).map((rows) {
      final liked = <String>{};
      final counts = <String, int>{};

      for (final row in rows) {
        final episodeId = row['episode_id'] as String;
        counts[episodeId] = (counts[episodeId] ?? 0) + 1;
        if (row['user_id'] == userId) {
          liked.add(episodeId);
        }
      }

      return LikeSnapshot(likedEpisodeIds: liked, counts: counts);
    });
  }

  Stream<Set<String>> streamLikedEpisodeIds(String userId) {
    return streamLikeSnapshot(userId)
        .map((snapshot) => snapshot.likedEpisodeIds);
  }

  Future<void> toggleLike({
    required String episodeId,
    required String userId,
    required bool currentlyLiked,
  }) async {
    if (currentlyLiked) {
      await _supabaseService.client
          .from('likes')
          .delete()
          .eq('user_id', userId)
          .eq('episode_id', episodeId);
      return;
    }

    await _supabaseService.client.from('likes').upsert(
      {
        'user_id': userId,
        'episode_id': episodeId,
      },
      onConflict: 'user_id,episode_id',
    );
  }
}
