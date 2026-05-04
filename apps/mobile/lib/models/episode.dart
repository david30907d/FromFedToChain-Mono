class Episode {
  const Episode({
    required this.id,
    required this.title,
    required this.hlsUrl,
    required this.createdAt,
    required this.listened,
    this.likeCount = 0,
    this.script,
  });

  final String id;
  final String title;
  final String hlsUrl;
  final DateTime createdAt;
  final bool listened;
  final int likeCount;
  final String? script;

  factory Episode.fromJson(Map<String, dynamic> json) {
    return Episode(
      id: json['id'] as String,
      title: json['title'] as String,
      hlsUrl: _readString(json, 'hlsUrl', 'hls_url'),
      createdAt: DateTime.parse(
        _readString(json, 'createdAt', 'created_at'),
      ).toLocal(),
      listened: json['listened'] as bool? ?? false,
      likeCount: _readInt(json, 'likeCount', 'like_count'),
      script: json['script'] as String?,
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
  }) {
    return Episode(
      id: id ?? this.id,
      title: title ?? this.title,
      hlsUrl: hlsUrl ?? this.hlsUrl,
      createdAt: createdAt ?? this.createdAt,
      listened: listened ?? this.listened,
      likeCount: likeCount ?? this.likeCount,
      script: script ?? this.script,
    );
  }

  static String _readString(
    Map<String, dynamic> json,
    String camelKey,
    String snakeKey,
  ) {
    return (json[camelKey] ?? json[snakeKey]) as String;
  }

  static int _readInt(
    Map<String, dynamic> json,
    String camelKey,
    String snakeKey,
  ) {
    final value = json[camelKey] ?? json[snakeKey];
    if (value is int) return value;
    if (value is num) return value.toInt();
    return int.tryParse(value?.toString() ?? '') ?? 0;
  }
}
