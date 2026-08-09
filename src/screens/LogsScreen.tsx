import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRoute } from '@react-navigation/native';
import { SleepEvent } from '../types';
import { generateMockSleepEvents } from '../services/mockBLEService';
import moment from 'moment';

const getSeverityStyle = (severity: string) => {
  switch (severity) {
    case 'high': return { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', label: 'HIGH' };
    case 'medium': return { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', label: 'MED' };
    default: return { color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)', label: 'LOW' };
  }
};

type FilterType = 'all' | 'snore' | 'intervention';
const LOGS_PER_PAGE = 10;

export const LogsScreen = () => {
  const route = useRoute();
  const paramEvents: SleepEvent[] = (route.params as any)?.events || [];
  const [events, setEvents] = useState<SleepEvent[]>(paramEvents);
  const [filter, setFilter] = useState<FilterType>('all');
  const [page, setPage] = useState(0);

  useEffect(() => {
    // If no events passed via params, self-load from mock service
    if (events.length === 0) {
      setEvents(generateMockSleepEvents());
    }
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

  const renderLogItem = ({ item, index }: { item: SleepEvent; index: number }) => {
    const sev = getSeverityStyle(item.severity);
    const isIntervention = item.interventionTriggered;
    const dateStr = moment(item.timestamp).format('MMM DD');
    const timeStr = moment(item.timestamp).format('hh:mm:ss A');

    return (
      <View style={styles.logRow}>
        {/* Index column */}
        <Text style={styles.indexText}>{String(index + 1).padStart(3, '0')}</Text>

        {/* Timestamp column */}
        <View style={styles.timestampCol}>
          <Text style={styles.dateText}>{dateStr}</Text>
          <Text style={styles.timeText}>{timeStr}</Text>
        </View>

        {/* Event type */}
        <View style={[styles.typeBadge, { backgroundColor: isIntervention ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255,255,255,0.04)' }]}>
          <FontAwesome5
            name={isIntervention ? 'wind' : 'wave-square'}
            size={10}
            color={isIntervention ? '#6366f1' : sev.color}
          />
          <Text style={[styles.typeText, { color: isIntervention ? '#818cf8' : '#9ca3af' }]}>
            {isIntervention ? 'INFLATE' : 'SNORE'}
          </Text>
        </View>

        {/* Severity badge */}
        <View style={[styles.severityBadge, { backgroundColor: sev.bg }]}>
          <Text style={[styles.severityText, { color: sev.color }]}>{sev.label}</Text>
        </View>

        {/* Duration */}
        <Text style={styles.durationText}>{item.duration}s</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleArea}>
          <Text style={styles.headerTitle}>Historical Logs</Text>
          <Text style={styles.headerSubtitle}>
            {filteredEvents.length === 0
              ? 'No events recorded'
              : `Showing ${rangeStart}–${rangeEnd} of ${filteredEvents.length}`}
          </Text>
        </View>
      </View>

      {/* Filter Chips */}
      <View style={styles.filterRow}>
        {(['all', 'snore', 'intervention'] as FilterType[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
              {f === 'all' ? 'All Events' : f === 'snore' ? 'Snore Only' : 'Interventions'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Column Headers */}
      <View style={styles.columnHeader}>
        <Text style={[styles.colLabel, { width: 36 }]}>#</Text>
        <Text style={[styles.colLabel, { flex: 1 }]}>TIMESTAMP</Text>
        <Text style={[styles.colLabel, { width: 80 }]}>TYPE</Text>
        <Text style={[styles.colLabel, { width: 44 }]}>SEV</Text>
        <Text style={[styles.colLabel, { width: 40, textAlign: 'right' }]}>DUR</Text>
      </View>

      {/* Log List */}
      <FlatList
        data={paginatedEvents}
        renderItem={({ item, index }) => renderLogItem({ item, index: currentPage * LOGS_PER_PAGE + index })}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 16 }}
        ListFooterComponent={
          totalPages > 1 ? (
            <View style={styles.paginationRow}>
              <TouchableOpacity
                style={[styles.paginationButton, currentPage === 0 && styles.paginationButtonDisabled]}
                onPress={() => setPage((p) => Math.max(0, p - 1))}
                disabled={currentPage === 0}
              >
                <FontAwesome5 name="chevron-left" size={12} color="#ffffff" />
                <Text style={styles.paginationButtonText}>Previous</Text>
              </TouchableOpacity>
              <Text style={styles.paginationLabel}>
                Page {currentPage + 1} of {totalPages}
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
  container: {
    flex: 1,
    backgroundColor: '#0a0b10',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  headerTitleArea: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
    marginTop: 2,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  filterChipActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderColor: 'rgba(99, 102, 241, 0.4)',
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6b7280',
  },
  filterChipTextActive: {
    color: '#ffffff',
  },
  columnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  colLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#6b7280',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  indexText: {
    width: 36,
    fontSize: 11,
    fontWeight: '600',
    color: '#4b5563',
    fontFamily: 'monospace',
  },
  timestampCol: {
    flex: 1,
  },
  dateText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#e5e7eb',
  },
  timeText: {
    fontSize: 10,
    color: '#6b7280',
    fontWeight: '500',
    marginTop: 1,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 80,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 5,
  },
  typeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  severityBadge: {
    width: 44,
    alignItems: 'center',
    paddingVertical: 3,
    borderRadius: 6,
  },
  severityText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  durationText: {
    width: 40,
    textAlign: 'right',
    fontSize: 12,
    fontWeight: '700',
    color: '#e5e7eb',
    fontFamily: 'monospace',
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    marginTop: 8,
  },
  paginationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.35)',
  },
  paginationButtonDisabled: {
    opacity: 0.35,
  },
  paginationButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  paginationLabel: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
  },
});
