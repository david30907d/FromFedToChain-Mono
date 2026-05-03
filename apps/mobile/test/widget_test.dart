import 'dart:convert';

import 'package:ai_podcast_mobile/screens/episodes_screen.dart';
import 'package:ai_podcast_mobile/services/api_service.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:ai_podcast_mobile/main.dart';

void main() {
  testWidgets('shows app title', (tester) async {
    SharedPreferences.setMockInitialValues({});

    await tester.pumpWidget(const AiPodcastApp());

    await tester.pump();
    expect(find.text('AI Podcast'), findsOneWidget);
  });

  testWidgets('loads next page when scrolled near the bottom', (tester) async {
    SharedPreferences.setMockInitialValues({});

    final requests = <Uri>[];
    final client = MockClient((request) async {
      requests.add(request.url);

      if (request.url.queryParameters['cursor'] == null) {
        return http.Response(
          jsonEncode({
            'items': List.generate(25, episodeJson),
            'nextCursor': 'cursor-1',
          }),
          200,
        );
      }

      return http.Response(
        jsonEncode({
          'items': <Map<String, Object?>>[],
          'nextCursor': null,
        }),
        200,
      );
    });

    await tester.pumpWidget(
      MaterialApp(
        home: EpisodesScreen(
          apiService: ApiService(
            baseUrl: 'http://api.test',
            client: client,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(requests, hasLength(1));
    expect(requests.single.queryParameters['limit'], '20');

    await tester.drag(find.byType(ListView), const Offset(0, -3000));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    expect(requests, hasLength(2));
    expect(requests.last.queryParameters['cursor'], 'cursor-1');
  });
}

Map<String, Object?> episodeJson(int index) {
  final createdAt = DateTime.now()
      .toUtc()
      .subtract(Duration(minutes: index))
      .toIso8601String();

  return {
    'id': 'episode-$index',
    'title': 'Episode $index',
    'hlsUrl': 'https://example.com/episode-$index.m3u8',
    'createdAt': createdAt,
    'listened': false,
    'script': null,
  };
}
