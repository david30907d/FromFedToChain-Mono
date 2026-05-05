class AudioTrack {
  const AudioTrack({
    required this.languageCode,
    required this.title,
    required this.hlsUrl,
  });

  final String languageCode;
  final String title;
  final String hlsUrl;

  bool get isPlayable => hlsUrl.trim().isNotEmpty;

  factory AudioTrack.fromJson(Map<String, dynamic> json) {
    final languageCode = _readOptionalString(
      json,
      'languageCode',
      'language_code',
    );
    final title = _readOptionalString(json, 'title', 'title');

    return AudioTrack(
      languageCode: languageCode,
      title: title.isNotEmpty ? title : languageCode,
      hlsUrl: _readOptionalString(json, 'hlsUrl', 'hls_url'),
    );
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        other is AudioTrack &&
            other.languageCode == languageCode &&
            other.title == title &&
            other.hlsUrl == hlsUrl;
  }

  @override
  int get hashCode => Object.hash(languageCode, title, hlsUrl);
}

class Episode {
  const Episode({
    required this.id,
    required this.title,
    required this.hlsUrl,
    required this.createdAt,
    required this.listened,
    this.likeCount = 0,
    this.script,
    this.audioTracks = const [],
  });

  final String id;
  final String title;
  final String hlsUrl;
  final DateTime createdAt;
  final bool listened;
  final int likeCount;
  final String? script;
  final List<AudioTrack> audioTracks;

  List<AudioTrack> get playableAudioTracks {
    return audioTracks.where((track) => track.isPlayable).toList(
          growable: false,
        );
  }

  factory Episode.fromJson(Map<String, dynamic> json) {
    return Episode(
      id: json['id'] as String,
      title: json['title'] as String,
      hlsUrl: _readRequiredString(json, 'hlsUrl', 'hls_url'),
      createdAt: DateTime.parse(
        _readRequiredString(json, 'createdAt', 'created_at'),
      ).toLocal(),
      listened: json['listened'] as bool? ?? false,
      likeCount: _readInt(json, 'likeCount', 'like_count'),
      script: json['script'] as String?,
      audioTracks: _readAudioTracks(json),
    );
  }

  Episode copyWith({
    String? id,
    String? title,
    String? hlsUrl,
    DateTime? createdAt,
    bool? listened,
    int? likeCount,
    String? script,
    List<AudioTrack>? audioTracks,
  }) {
    return Episode(
      id: id ?? this.id,
      title: title ?? this.title,
      hlsUrl: hlsUrl ?? this.hlsUrl,
      createdAt: createdAt ?? this.createdAt,
      listened: listened ?? this.listened,
      likeCount: likeCount ?? this.likeCount,
      script: script ?? this.script,
      audioTracks: audioTracks ?? this.audioTracks,
    );
  }
}

String _readRequiredString(
  Map<String, dynamic> json,
  String camelKey,
  String snakeKey,
) {
  return (json[camelKey] ?? json[snakeKey]) as String;
}

String _readOptionalString(
  Map<String, dynamic> json,
  String camelKey,
  String snakeKey,
) {
  return (json[camelKey] ?? json[snakeKey])?.toString() ?? '';
}

int _readInt(
  Map<String, dynamic> json,
  String camelKey,
  String snakeKey,
) {
  final value = json[camelKey] ?? json[snakeKey];
  if (value is int) return value;
  if (value is num) return value.toInt();
  return int.tryParse(value?.toString() ?? '') ?? 0;
}

List<AudioTrack> _readAudioTracks(Map<String, dynamic> json) {
  final value = json['audioTracks'] ?? json['audio_tracks'];
  if (value is! List) return const [];

  return value
      .whereType<Map>()
      .map((track) => AudioTrack.fromJson(Map<String, dynamic>.from(track)))
      .where((track) => track.isPlayable)
      .toList(growable: false);
}
