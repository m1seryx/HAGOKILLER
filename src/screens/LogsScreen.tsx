import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { SleepEvent } from '../types';
import { bleService } from '../services/bleService';
import moment from 'moment';

const getSeverityStyle = (severity: string) => {
  switch (severity) {
    case 'high': return { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.14)', label: 'High' };
    case 'medium': return { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.14)', label: 'Medium' };
    default: return { color: '#10b981', bg: 'rgba(16, 185, 129, 0.14)', label: 'Low' };
  }
};

type FilterType = 'all' | 'snore' | 'intervention';
const LOGS_PER_PAGE = 10;

export const LogsScreen = () => {
  const [events, setEvents] = useState<SleepEvent[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
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
  }, [filter]);

  const filteredEvents = events.filter((e) => {
    if (filter === 'intervention') return e.interventionTriggered;
    if (filter === 'snore') return !e.interventionTriggered;
    return true;
  });

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
            </Text>
          ) : null}
        </View>
        <View style={styles.logRight}>
          <View style={[styles.severityPill, { backgroundColor: sev.bg }]}>
            <Text style={[styles.severityText, { color: sev.color }]}>{sev.label}</Text>
          </View>
          <Text style={styles.durationText}>{item.duration}s</Text>
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
          { id: 'snore', label: 'Snores' },
          { id: 'intervention', label: 'Inflates' },
        ] as const).map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.filterChip, filter === item.id && styles.filterChipActive]}
            onPress={() => setFilter(item.id)}
          >
            <Text style={[styles.filterChipText, filter === item.id && styles.filterChipTextActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

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
  container: { flex: 1, backgroundColor: '#0a0b10' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
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
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#ffffff' },
  headerSubtitle: { fontSize: 13, color: '#94a3b8', fontWeight: '500', marginTop: 4 },
  filterRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 4,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  filterChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  filterChipActive: { backgroundColor: 'rgba(99, 102, 241, 0.28)' },
  filterChipText: { fontSize: 13, fontWeight: '600', color: '#6b7280' },
  filterChipTextActive: { color: '#ffffff', fontWeight: '800' },
  listContent: { paddingHorizontal: 16, paddingBottom: 28 },
  logCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
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
  logTitle: { color: '#f8fafc', fontSize: 14, fontWeight: '700', marginBottom: 3 },
  logMeta: { color: '#94a3b8', fontSize: 12 },
  logRight: { alignItems: 'flex-end' },
  severityPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 6,
  },
  severityText: { fontSize: 11, fontWeight: '800' },
  durationText: { color: '#e5e7eb', fontSize: 13, fontWeight: '700' },
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
  emptyText: { color: '#94a3b8', textAlign: 'center', fontSize: 14, fontWeight: '600' },
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
    backgroundColor: 'rgba(99, 102, 241, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.35)',
  },
  paginationButtonDisabled: { opacity: 0.35 },
  paginationButtonText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
  paginationLabel: { color: '#9ca3af', fontSize: 13, fontWeight: '700' },
});
