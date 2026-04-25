class Episode {
  const Episode({
    required this.id,
    required this.title,
    required this.audioUrl,
    required this.createdAt,
    required this.listened,
  });

  final String id;
  final String title;
  final String audioUrl;
  final DateTime createdAt;
  final bool listened;

  factory Episode.fromJson(Map<String, dynamic> json) {
    return Episode(
      id: json['id'] as String,
      title: json['title'] as String,
      audioUrl: json['audioUrl'] as String,
      createdAt: DateTime.parse(json['createdAt'] as String).toLocal(),
      listened: json['listened'] as bool? ?? false,
    );
  }

  Episode copyWith({
    String? id,
    String? title,
    String? audioUrl,
    DateTime? createdAt,
    bool? listened,
  }) {
    return Episode(
      id: id ?? this.id,
      title: title ?? this.title,
      audioUrl: audioUrl ?? this.audioUrl,
      createdAt: createdAt ?? this.createdAt,
      listened: listened ?? this.listened,
    );
  }
}
