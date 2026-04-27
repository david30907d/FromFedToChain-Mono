class Episode {
  const Episode({
    required this.id,
    required this.title,
    required this.hlsUrl,
    required this.createdAt,
    required this.listened,
  });

  final String id;
  final String title;
  final String hlsUrl;
  final DateTime createdAt;
  final bool listened;

  factory Episode.fromJson(Map<String, dynamic> json) {
    return Episode(
      id: json['id'] as String,
      title: json['title'] as String,
      hlsUrl: json['hlsUrl'] as String,
      createdAt: DateTime.parse(json['createdAt'] as String).toLocal(),
      listened: json['listened'] as bool? ?? false,
    );
  }

  Episode copyWith({
    String? id,
    String? title,
    String? hlsUrl,
    DateTime? createdAt,
    bool? listened,
  }) {
    return Episode(
      id: id ?? this.id,
      title: title ?? this.title,
      hlsUrl: hlsUrl ?? this.hlsUrl,
      createdAt: createdAt ?? this.createdAt,
      listened: listened ?? this.listened,
    );
  }
}
