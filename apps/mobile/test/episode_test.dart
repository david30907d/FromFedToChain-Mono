import 'package:flutter_test/flutter_test.dart';
import 'package:ai_podcast_mobile/models/episode.dart';

void main() {
  group('Episode', () {
    test('fromJson maps all fields correctly', () {
      final json = {
        'id': 'uuid-123',
        'title': 'Test Episode',
        'hlsUrl': 'https://cdn.example.com/episodes/uuid-123/playlist.m3u8',
        'createdAt': '2024-01-01T12:00:00.000Z',
        'listened': true,
        'likeCount': 7,
        'script': 'This is the script content',
      };

      final episode = Episode.fromJson(json);

      expect(episode.id, 'uuid-123');
      expect(episode.title, 'Test Episode');
      expect(episode.hlsUrl,
          'https://cdn.example.com/episodes/uuid-123/playlist.m3u8');
      expect(episode.listened, true);
      expect(episode.likeCount, 7);
      expect(episode.script, 'This is the script content');
    });

    test('fromJson maps Supabase snake case fields', () {
      final episode = Episode.fromJson({
        'id': 'uuid-999',
        'title': 'Snake Case Episode',
        'hls_url': 'https://cdn.example.com/episode.m3u8',
        'created_at': '2024-01-04T12:00:00.000Z',
        'like_count': 12,
      });

      expect(episode.hlsUrl, 'https://cdn.example.com/episode.m3u8');
      expect(episode.likeCount, 12);
      expect(episode.listened, false);
    });

    test('fromJson handles null script', () {
      final json = {
        'id': 'uuid-456',
        'title': 'No Script Episode',
        'hlsUrl': 'https://cdn.example.com/episodes/uuid-456/playlist.m3u8',
        'createdAt': '2024-01-02T12:00:00.000Z',
        'listened': false,
        'script': null,
      };

      final episode = Episode.fromJson(json);

      expect(episode.script, isNull);
    });

    test('fromJson handles missing script key', () {
      final json = {
        'id': 'uuid-789',
        'title': 'Missing Script Key',
        'hlsUrl': 'https://cdn.example.com/episodes/uuid-789/playlist.m3u8',
        'createdAt': '2024-01-03T12:00:00.000Z',
        'listened': false,
      };

      final episode = Episode.fromJson(json);

      expect(episode.script, isNull);
    });

    test('copyWith overrides script', () {
      final original = Episode(
        id: 'uuid-123',
        title: 'Original',
        hlsUrl: 'https://example.com/hls.m3u8',
        createdAt: DateTime(2024, 1, 1),
        listened: false,
        likeCount: 1,
        script: 'Original script',
      );

      final updated = original.copyWith(script: 'New script', likeCount: 2);

      expect(updated.id, original.id);
      expect(updated.title, original.title);
      expect(updated.likeCount, 2);
      expect(updated.script, 'New script');
    });

    test('copyWith preserves script when not provided', () {
      final original = Episode(
        id: 'uuid-123',
        title: 'Original',
        hlsUrl: 'https://example.com/hls.m3u8',
        createdAt: DateTime(2024, 1, 1),
        listened: false,
        script: 'Preserved script',
      );

      final updated = original.copyWith(title: 'Updated Title');

      expect(updated.script, 'Preserved script');
      expect(updated.title, 'Updated Title');
    });
  });
}
