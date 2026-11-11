import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, useWindowDimensions, Image, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { SleepEvent } from '../types';
import { bleService } from '../services/bleService';
import { LogDetailSheet, LogBadge, LogItem, SleepEventMeters } from '../components/LogDetailSheet';
import { colors } from '../constants/theme';
import moment from 'moment';

const getSeverityStyle = (severity: string) => {
  switch (severity) {
    case 'high': return { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.14)', label: 'High' };
    case 'medium': return { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.14)', label: 'Medium' };
    default: return { color: '#10b981', bg: 'rgba(16, 185, 129, 0.14)', label: 'Low' };
  }
};

const SEVERITY_RANK: Record<SleepEvent['severity'], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const HAGOSAUR_SEVERITY_FACES = {
  low: require('../../assets/hagosaur-face-low.png'),
  medium: require('../../assets/hagosaur-face-medium.png'),
  high: require('../../assets/hagosaur-face-high.png'),
};

const HAGOSAUR_INFLATING_PILLOW = require('../../assets/hagosaur-inflating-pillow.png');
const HAGOSAUR_HEADER = require('../../assets/hagosaur-face-sleepy.png');

type FilterType = 'all' | 'severity' | 'duration' | 'inflation';
type SeverityFilter = 'all' | 'low' | 'medium' | 'high';
const LOGS_PER_PAGE = 10;

const FILTERS: ReadonlyArray<{ id: FilterType; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'severity', label: 'Severity' },
  { id: 'duration', label: 'Duration' },
  { id: 'inflation', label: 'Inflation' },
];

const toEventItem = (event: SleepEvent): LogItem => ({
  kind: 'event', key: event.id, timestamp: event.timestamp, event,
});

const formatPumpDuration = (seconds: number) => {
  if (seconds <= 0) return '';
  if (seconds % 60 === 0) {
    const minutes = seconds / 60;
    return minutes === 1 ? '1 min pump' : `${minutes} min pump`;
  }
  return `${seconds}s pump`;
};

export const LogsScreen = () => {
  const { width } = useWindowDimensions();
  const compact = width < 380;
  const [events, setEvents] = useState<SleepEvent[]>([]);
  const [selectedItem, setSelectedItem] = useState<LogItem | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [page, setPage] = useState(0);

  useEffect(() => {
    let cancelled = false;
    bleService
      .fetchSleepEvents()
      .then((next) => {
        if (!cancelled) setEvents(next);
      })
      .catch(() => undefined);

    const unsubscribe = bleService.subscribeEvents((event) => {
      if (!cancelled) setEvents((current) => [event, ...current]);
    });

    const unsubReload = (bleService as any).subscribeReload?.(() => {
      if (!cancelled) {
        bleService
          .fetchSleepEvents()
          .then((next) => { if (!cancelled) setEvents(next); })
          .catch(() => undefined);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
      unsubReload?.();
    };
  }, []);

  // Re-fetch when user navigates to this tab (e.g. after clearing data from Settings)
  useFocusEffect(
    useCallback(() => {
      bleService
        .fetchSleepEvents()
        .then((next) => setEvents(next))
        .catch(() => undefined);
    }, [])
  );

  useEffect(() => {
    setPage(0);
  }, [filter, severityFilter]);

  const filteredEvents = useMemo<LogItem[]>(() => {
    const newestFirst = (a: { timestamp: number }, b: { timestamp: number }) => b.timestamp - a.timestamp;

    if (filter === 'inflation') {
      return events.filter((e) => e.interventionTriggered).sort(newestFirst).map(toEventItem);
    }

    if (filter === 'severity') {
      const next = severityFilter === 'all' ? [...events] : events.filter((e) => e.severity === severityFilter);
      next.sort((a, b) => {
        const rank = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
        return rank !== 0 ? rank : b.timestamp - a.timestamp;
      });
      return next.map(toEventItem);
    }

    if (filter === 'duration') {
      const next = [...events];
      next.sort((a, b) => {
        const aLen = Math.max(a.duration, a.interventionDuration || 0);
        const bLen = Math.max(b.duration, b.interventionDuration || 0);
        return bLen - aLen || b.timestamp - a.timestamp;
      });
      return next.map(toEventItem);
    }

    return [...events].sort(newestFirst).map(toEventItem);
  }, [events, filter, severityFilter]);

  const summary = useMemo(() => {
    const inflations = events.filter((e) => e.interventionTriggered).length;
    return {
      snores: events.length - inflations,
      inflations,
    };
  }, [events]);

  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / LOGS_PER_PAGE));
  const currentPage = Math.min(page, totalPages - 1);
  const paginatedEvents = filteredEvents.slice(
    currentPage * LOGS_PER_PAGE,
    currentPage * LOGS_PER_PAGE + LOGS_PER_PAGE,
  );
  const rangeStart = filteredEvents.length === 0 ? 0 : currentPage * LOGS_PER_PAGE + 1;
  const rangeEnd = Math.min(filteredEvents.length, (currentPage + 1) * LOGS_PER_PAGE);

  const artworkFor = (logItem: LogItem) => {
    if (logItem.kind !== 'event') return HAGOSAUR_SEVERITY_FACES.low;
    return logItem.event.interventionTriggered
      ? HAGOSAUR_INFLATING_PILLOW
      : HAGOSAUR_SEVERITY_FACES[logItem.event.severity];
  };

  const badgeFor = (logItem: LogItem): LogBadge =>
    logItem.kind === 'event'
      ? getSeverityStyle(logItem.event.severity)
      : getSeverityStyle('low');

  const renderLogItem = ({ item: logItem }: { item: LogItem }) => {
    if (logItem.kind !== 'event') return null;
    const item = logItem.event;
    const sev = getSeverityStyle(item.severity);
    const isIntervention = item.interventionTriggered;
    const pumpLabel = formatPumpDuration(item.interventionDuration);

    return (
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={() => setSelectedItem(logItem)}
        accessibilityRole="button"
        accessibilityHint="Shows full event details"
        style={[styles.logCard, compact && styles.logCardCompact]}
      >
        <View style={[styles.iconWrap, { backgroundColor: isIntervention ? 'rgba(14,165,233,0.16)' : sev.bg }]}>
          <Image
            source={isIntervention ? HAGOSAUR_INFLATING_PILLOW : HAGOSAUR_SEVERITY_FACES[item.severity]}
            style={[styles.hagosaurIcon, isIntervention && styles.interventionIcon]}
            resizeMode="contain"
            accessible
            accessibilityLabel={
              isIntervention
                ? 'Hagosaur inflating the smart pillow'
                : `Hagosaur showing ${sev.label.toLowerCase()} snoring severity`
            }
          />
        </View>
        <View style={styles.logBody}>
          <View style={styles.logTopRow}>
            <Text style={styles.logTitle} numberOfLines={1}>
              {isIntervention ? 'Pillow inflated' : 'Snore detected'}
            </Text>
            <View style={[styles.severityPill, { backgroundColor: sev.bg }]}>
              <Text style={[styles.severityText, { color: sev.color }]}>{sev.label}</Text>
            </View>
          </View>
          <Text style={styles.logDate}>{moment(item.timestamp).format('ddd, MMM D · h:mm A')}</Text>
          <SleepEventMeters event={item} />
        </View>
      </TouchableOpacity>
    );
  };

  const listHeader = (
    <View>
      <View style={styles.header}>
        <Text style={styles.brand}>HAGOKILLER</Text>
        <Text style={styles.headerTitle}>History Logs</Text>
        <Text style={styles.headerSubtitle}>{moment().format('dddd, MMMM D, YYYY')}</Text>

        <View style={[styles.headerGlass, compact && styles.headerGlassCompact]}>
          <Image
            source={HAGOSAUR_HEADER}
            style={[styles.headerHagosaur, compact && styles.headerHagosaurCompact]}
            resizeMode="contain"
            accessibilityLabel="Hagosaur reviewing your sleep history"
          />
          <View style={styles.headerGlassCopy}>
            <Text style={styles.headerEyebrow}>YOUR SLEEP HISTORY</Text>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{summary.snores}</Text>
                <Text style={styles.summaryLabel}>Snoring Count</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{summary.inflations}</Text>
                <Text style={styles.summaryLabel}>Inflations</Text>
              </View>
            </View>
            <Text style={styles.headerCaption} numberOfLines={1}>
              {summary.inflations > 0
                ? `${summary.inflations} pillow inflation${summary.inflations === 1 ? '' : 's'} logged`
                : 'No inflations logged yet'}
            </Text>
          </View>
        </View>

        <Text style={styles.rangeText}>
          {filteredEvents.length === 0
            ? 'No logs recorded'
            : `Showing ${rangeStart}–${rangeEnd} of ${filteredEvents.length} logs · tap a log for details`}
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterRow}
      >
        {FILTERS.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.filterChip, filter === item.id && styles.filterChipActive]}
            onPress={() => {
              setFilter(item.id);
              if (item.id !== 'severity') setSeverityFilter('all');
            }}
          >
            <Text style={[styles.filterChipText, filter === item.id && styles.filterChipTextActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {filter === 'severity' ? (
        <View style={styles.subFilterRow}>
          {([
            { id: 'all', label: 'All' },
            { id: 'high', label: 'High' },
            { id: 'medium', label: 'Medium' },
            { id: 'low', label: 'Low' },
          ] as const).map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.subFilterChip, severityFilter === item.id && styles.filterChipActive]}
              onPress={() => setSeverityFilter(item.id)}
            >
              <Text style={[styles.filterChipText, severityFilter === item.id && styles.filterChipTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.pageColumn}>
      <FlatList
        style={styles.list}
        ListHeaderComponent={listHeader}
        data={paginatedEvents}
        renderItem={renderLogItem}
        keyExtractor={(item) => item.key}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.listContent, compact && styles.listContentCompact]}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Image
              source={require('../../assets/hagosaur-empty-logs.png')}
              style={styles.emptyArtwork}
              resizeMode="contain"
              accessible
              accessibilityLabel="Hagosaur checking an empty sleep log"
            />
            <Text style={styles.emptyTitle}>Quiet night here</Text>
            <Text style={styles.emptyText}>No events match this filter yet.</Text>
          </View>
        }
        ListFooterComponent={
          totalPages > 1 ? (
            <View style={styles.paginationRow}>
              <TouchableOpacity
                style={[styles.paginationButton, currentPage === 0 && styles.paginationButtonDisabled]}
                onPress={() => setPage((p) => Math.max(0, p - 1))}
                disabled={currentPage === 0}
              >
                <FontAwesome5 name="chevron-left" size={12} color="#ffffff" />
                <Text style={styles.paginationButtonText}>Prev</Text>
              </TouchableOpacity>
              <Text style={styles.paginationLabel}>
                {currentPage + 1} / {totalPages}
              </Text>
              <TouchableOpacity
                style={[styles.paginationButton, currentPage >= totalPages - 1 && styles.paginationButtonDisabled]}
                onPress={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={currentPage >= totalPages - 1}
              >
                <Text style={styles.paginationButtonText}>Next</Text>
                <FontAwesome5 name="chevron-right" size={12} color="#ffffff" />
              </TouchableOpacity>
            </View>
          ) : null
        }
      />
      </View>
      <LogDetailSheet
        item={selectedItem}
        artwork={selectedItem ? artworkFor(selectedItem) : undefined}
        badge={selectedItem ? badgeFor(selectedItem) : undefined}
        onClose={() => setSelectedItem(null)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  pageColumn: { flex: 1, width: '100%', maxWidth: 720, alignSelf: 'center' },
  header: { paddingTop: 18, paddingBottom: 12 },
  brand: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
    marginBottom: 3,
  },
  headerTitle: { fontSize: 26, fontWeight: '800', color: colors.text, marginBottom: 3 },
  headerSubtitle: { fontSize: 12, lineHeight: 18, color: colors.textMuted, marginBottom: 14 },
  headerGlass: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundSoft,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerGlassCompact: { paddingHorizontal: 12, paddingVertical: 12 },
  headerHagosaur: { width: 72, height: 72, marginRight: 14 },
  headerHagosaurCompact: { width: 58, height: 58, marginRight: 10 },
  headerGlassCopy: { flex: 1, minWidth: 0 },
  headerEyebrow: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  summaryItem: { flex: 1, minWidth: 0 },
  summaryValue: { fontSize: 20, fontWeight: '800', color: colors.text },
  summaryLabel: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
  headerCaption: { fontSize: 12, color: colors.textMuted, fontWeight: '500' },
  rangeText: { fontSize: 12, color: colors.textMuted, fontWeight: '600', marginTop: 12 },
  filterScroll: {
    flexGrow: 0,
    marginBottom: 12,
    borderRadius: 16,
    backgroundColor: colors.backgroundMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterRow: {
    flexDirection: 'row',
    padding: 4,
    gap: 2,
  },
  filterChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  filterChipActive: { backgroundColor: colors.accent },
  filterChipText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  filterChipTextActive: { color: colors.onAccent, fontWeight: '800' },
  subFilterRow: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 8,
  },
  subFilterChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: colors.backgroundMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingBottom: 28 },
  listContentCompact: { paddingHorizontal: 12 },
  logCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  logCardCompact: { padding: 12, borderRadius: 14 },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  hagosaurIcon: { width: 43, height: 43 },
  interventionIcon: { width: 48, height: 48 },
  logBody: { flex: 1, minWidth: 0 },
  logTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  logTitle: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '700' },
  logDate: { color: colors.textMuted, fontSize: 12, marginTop: 3 },
  logBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 7,
    paddingTop: 7,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  logMeta: { flex: 1, color: colors.textMuted, fontSize: 11 },
  pumpCaption: { color: colors.accentDark, fontSize: 11, fontWeight: '700', marginTop: 6 },
  severityPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  severityText: { fontSize: 11, fontWeight: '800' },
  readyText: { color: '#10b981', fontSize: 12, fontWeight: '800' },
  emptyWrap: { alignItems: 'center', marginTop: 28, paddingHorizontal: 28 },
  emptyArtwork: { width: 178, height: 190, marginBottom: 2 },
  emptyTitle: {
    color: colors.text,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 5,
  },
  emptyText: { color: colors.textMuted, textAlign: 'center', fontSize: 13, fontWeight: '600' },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
  },
  paginationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.accent,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  paginationButtonDisabled: { opacity: 0.35 },
  paginationButtonText: { color: colors.onAccent, fontSize: 13, fontWeight: '700' },
  paginationLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
});
