import '../models/episode.dart';

sealed class EpisodeFeedRow {
  const EpisodeFeedRow();
}

class EpisodeMonthHeaderRow extends EpisodeFeedRow {
  const EpisodeMonthHeaderRow(
    this.monthKey,
    this.label,
    this.loadedCount,
    this.collapsed,
  );

  final String monthKey;
  final String label;
  final int loadedCount;
  final bool collapsed;
}

class EpisodeItemRow extends EpisodeFeedRow {
  const EpisodeItemRow(this.episode);

  final Episode episode;
}

class EpisodeLoadMoreRow extends EpisodeFeedRow {
  const EpisodeLoadMoreRow(this.loading, this.error);

  final bool loading;
  final String? error;
}

List<EpisodeFeedRow> buildEpisodeFeedRows({
  required List<Episode> episodes,
  required Set<String> collapsedMonths,
  required String? nextCursor,
  required bool loadingMore,
  required String? loadMoreError,
}) {
  final rows = <EpisodeFeedRow>[];
  String? currentKey;
  int monthCount = 0;
  int headerIndex = -1;

  for (final episode in episodes) {
    final key = episodeMonthKey(episode.createdAt);

    if (key != currentKey) {
      if (headerIndex >= 0) {
        final header = rows[headerIndex] as EpisodeMonthHeaderRow;
        rows[headerIndex] = EpisodeMonthHeaderRow(
          header.monthKey,
          header.label,
          monthCount,
          header.collapsed,
        );
      }

      currentKey = key;
      monthCount = 0;
      headerIndex = rows.length;
      rows.add(
        EpisodeMonthHeaderRow(
          key,
          episodeMonthLabel(episode.createdAt),
          0,
          collapsedMonths.contains(key),
        ),
      );
    }

    monthCount++;
    if (!collapsedMonths.contains(key)) {
      rows.add(EpisodeItemRow(episode));
    }
  }

  if (headerIndex >= 0) {
    final header = rows[headerIndex] as EpisodeMonthHeaderRow;
    rows[headerIndex] = EpisodeMonthHeaderRow(
      header.monthKey,
      header.label,
      monthCount,
      header.collapsed,
    );
  }

  if (nextCursor != null || loadingMore || loadMoreError != null) {
    rows.add(EpisodeLoadMoreRow(loadingMore, loadMoreError));
  }

  return rows;
}

String episodeMonthKey(DateTime date) {
  final year = date.year.toString().padLeft(4, '0');
  final month = date.month.toString().padLeft(2, '0');
  return '$year-$month';
}

String episodeMonthLabel(DateTime date) {
  const monthNames = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  return '${monthNames[date.month - 1]} ${date.year}';
}
