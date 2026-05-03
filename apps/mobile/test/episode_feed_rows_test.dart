import 'package:ai_podcast_mobile/models/episode.dart';
import 'package:ai_podcast_mobile/screens/episode_feed_rows.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  Episode episode({
    required String id,
    required DateTime createdAt,
  }) {
    return Episode(
      id: id,
      title: 'Episode $id',
      hlsUrl: 'https://example.com/$id.m3u8',
      createdAt: createdAt,
      listened: false,
    );
  }

  group('buildEpisodeFeedRows', () {
    test('groups two months with headers and episode rows', () {
      final rows = buildEpisodeFeedRows(
        episodes: [
          episode(id: 'may-1', createdAt: DateTime(2026, 5, 2)),
          episode(id: 'apr-1', createdAt: DateTime(2026, 4, 30)),
        ],
        collapsedMonths: const {},
        nextCursor: null,
        loadingMore: false,
        loadMoreError: null,
      );

      expect(rows, hasLength(4));
      expect(rows[0], isA<EpisodeMonthHeaderRow>());
      expect((rows[0] as EpisodeMonthHeaderRow).label, 'May 2026');
      expect((rows[0] as EpisodeMonthHeaderRow).loadedCount, 1);
      expect(rows[1], isA<EpisodeItemRow>());
      expect(rows[2], isA<EpisodeMonthHeaderRow>());
      expect((rows[2] as EpisodeMonthHeaderRow).label, 'Apr 2026');
      expect((rows[2] as EpisodeMonthHeaderRow).loadedCount, 1);
      expect(rows[3], isA<EpisodeItemRow>());
    });

    test('omits episode rows for a collapsed month', () {
      final rows = buildEpisodeFeedRows(
        episodes: [
          episode(id: 'may-1', createdAt: DateTime(2026, 5, 2)),
          episode(id: 'apr-1', createdAt: DateTime(2026, 4, 30)),
        ],
        collapsedMonths: const {'2026-04'},
        nextCursor: null,
        loadingMore: false,
        loadMoreError: null,
      );

      expect(rows, hasLength(3));
      expect((rows[2] as EpisodeMonthHeaderRow).monthKey, '2026-04');
      expect((rows[2] as EpisodeMonthHeaderRow).collapsed, true);
    });

    test('adds a load-more row when there is a next cursor', () {
      final rows = buildEpisodeFeedRows(
        episodes: [
          episode(id: 'may-1', createdAt: DateTime(2026, 5, 2)),
        ],
        collapsedMonths: const {},
        nextCursor: 'cursor',
        loadingMore: false,
        loadMoreError: null,
      );

      expect(rows.last, isA<EpisodeLoadMoreRow>());
    });

    test('returns no rows for an empty episode list', () {
      final rows = buildEpisodeFeedRows(
        episodes: const [],
        collapsedMonths: const {},
        nextCursor: null,
        loadingMore: false,
        loadMoreError: null,
      );

      expect(rows, isEmpty);
    });
  });
}
