import React, { useMemo, useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { SleepEvent } from '../types';
import { bleService } from '../services/bleService';
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

type FilterType = 'all' | 'severity' | 'durations';
type SeverityFilter = 'all' | 'low' | 'medium' | 'high';
const LOGS_PER_PAGE = 10;

const formatSnoreDuration = (seconds: number) => {
  if (seconds >= 60) return `${Math.round(seconds / 60)}m`;
  return `${seconds}s`;
};

const formatPumpDuration = (seconds: number) => {
  if (seconds <= 0) return '';
  if (seconds % 60 === 0) {
    const minutes = seconds / 60;
    return minutes === 1 ? '1 min pump' : `${minutes} min pump`;
  }
  return `${seconds}s pump`;
};

export const LogsScreen = () => {
  const [events, setEvents] = useState<SleepEvent[]>([]);
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

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    setPage(0);
  }, [filter, severityFilter]);

  const filteredEvents = useMemo(() => {
    let next = [...events];
    if (filter === 'severity' && severityFilter !== 'all') {
      next = next.filter((e) => e.severity === severityFilter);
    }
    if (filter === 'severity') {
      next.sort((a, b) => {
        const rank = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
        return rank !== 0 ? rank : b.timestamp - a.timestamp;
      });
    } else if (filter === 'durations') {
      next.sort((a, b) => {
        const aLen = Math.max(a.duration, a.interventionDuration || 0);
        const bLen = Math.max(b.duration, b.interventionDuration || 0);
        return bLen - aLen || b.timestamp - a.timestamp;
      });
    } else {
      next.sort((a, b) => b.timestamp - a.timestamp);
    }
    return next;
  }, [events, filter, severityFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / LOGS_PER_PAGE));
  const currentPage = Math.min(page, totalPages - 1);
  const paginatedEvents = filteredEvents.slice(
    currentPage * LOGS_PER_PAGE,
    currentPage * LOGS_PER_PAGE + LOGS_PER_PAGE,
  );
  const rangeStart = filteredEvents.length === 0 ? 0 : currentPage * LOGS_PER_PAGE + 1;
  const rangeEnd = Math.min(filteredEvents.length, (currentPage + 1) * LOGS_PER_PAGE);

  const renderLogItem = ({ item }: { item: SleepEvent }) => {
    const sev = getSeverityStyle(item.severity);
    const isIntervention = item.interventionTriggered;
    const pumpLabel = formatPumpDuration(item.interventionDuration);

    return (
      <View style={styles.logCard}>
        <View style={[styles.iconWrap, { backgroundColor: isIntervention ? 'rgba(99,102,241,0.16)' : sev.bg }]}>
          <FontAwesome5
            name={isIntervention ? 'wind' : 'wave-square'}
            size={14}
            color={isIntervention ? '#818cf8' : sev.color}
          />
        </View>
        <View style={styles.logBody}>
          <Text style={styles.logTitle}>{isIntervention ? 'Pillow inflated' : 'Snore detected'}</Text>
          <Text style={styles.logMeta}>{moment(item.timestamp).format('ddd, MMM D · h:mm A')}</Text>
          {item.level != null || item.rms != null ? (
            <Text style={styles.logMeta}>
              {item.level != null ? `VOL ${item.level}` : 'Snore'}
              {item.rms != null ? ` · RMS ${item.rms}` : ''}
              {pumpLabel ? ` · ${pumpLabel}` : ''}
            </Text>
          ) : pumpLabel ? (
            <Text style={styles.logMeta}>{pumpLabel}</Text>
          ) : null}
        </View>
        <View style={styles.logRight}>
          <View style={[styles.severityPill, { backgroundColor: sev.bg }]}>
            <Text style={[styles.severityText, { color: sev.color }]}>{sev.label}</Text>
          </View>
          <Text style={styles.durationText}>{formatSnoreDuration(item.duration)}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <FontAwesome5 name="clipboard-list" size={16} color="#c7d2fe" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Historical Logs</Text>
          <Text style={styles.headerSubtitle}>
            {filteredEvents.length === 0
              ? 'No events recorded'
              : `Showing ${rangeStart}–${rangeEnd} of ${filteredEvents.length}`}
          </Text>
        </View>
      </View>

      <View style={styles.filterRow}>
        {([
          { id: 'all', label: 'All' },
          { id: 'severity', label: 'Severity' },
          { id: 'durations', label: 'Durations' },
        ] as const).map((item) => (
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
      </View>

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

      <FlatList
        data={paginatedEvents}
        renderItem={renderLogItem}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIcon}>
              <FontAwesome5 name="moon" size={18} color="#818cf8" />
            </View>
            <Text style={styles.emptyText}>No events for this filter.</Text>
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 20,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(99, 102, 241, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  headerSubtitle: { fontSize: 13, color: colors.textMuted, fontWeight: '500', marginTop: 4 },
  filterRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 4,
    borderRadius: 16,
    backgroundColor: colors.backgroundMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  filterChipActive: { backgroundColor: colors.accent },
  filterChipText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  filterChipTextActive: { color: colors.onAccent, fontWeight: '800' },
  subFilterRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
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
  listContent: { paddingHorizontal: 16, paddingBottom: 28 },
  logCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  logBody: { flex: 1, paddingRight: 8 },
  logTitle: { color: colors.text, fontSize: 14, fontWeight: '700', marginBottom: 3 },
  logMeta: { color: colors.textMuted, fontSize: 12 },
  logRight: { alignItems: 'flex-end' },
  severityPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 6,
  },
  severityText: { fontSize: 11, fontWeight: '800' },
  durationText: { color: colors.textSecondary, fontSize: 13, fontWeight: '700' },
  emptyWrap: { alignItems: 'center', marginTop: 48 },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(99,102,241,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyText: { color: colors.textMuted, textAlign: 'center', fontSize: 14, fontWeight: '600' },
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
