import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, SafeAreaView,
  ActivityIndicator, RefreshControl, TouchableOpacity, Modal,
} from 'react-native';
import moment from 'moment';
import { DashboardData, DailyStats, MonthlyStats } from '../types';
import { calculateDailyStats, calculateMonthlyStats, calculateTrend } from '../utils/statsCalculator';
import { getRecommendations, getSeverityColor } from '../utils/recommendations';
import { StatsCard } from '../components/StatsCard';
import { SnorePatternsChart } from '../components/SnorePatternsChart';
import { RecommendationCard } from '../components/RecommendationCard';
import { StatsFilter, TimePeriod, DateRange } from '../components/StatsFilter';
import { calculateDashboardData, MockBLEService } from '../services/mockBLEService';
import { FontAwesome5 } from '@expo/vector-icons';

type SimulatedSeverity = 'normal' | 'bad' | 'danger';

interface DashboardScreenProps {
  userName: string;
}

const SEVERITY_EVENTS: Record<SimulatedSeverity, number> = {
  normal: 2,
  bad: 7,
  danger: 13,
};

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ userName }) => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<TimePeriod>('week');
  const [monthHistory, setMonthHistory] = useState<MonthlyStats[]>([]);
  const [simulatedSeverity, setSimulatedSeverity] = useState<SimulatedSeverity>('bad');
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>({
    from: moment().subtract(7, 'days').format('YYYY-MM-DD'),
    to: moment().format('YYYY-MM-DD'),
  });

  const bleService = useRef(new MockBLEService()).current;

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const events = await bleService.fetchSleepEvents();
      const data = calculateDashboardData(events);
      setDashboardData(data);
      const now = moment();
      const months: MonthlyStats[] = [];
      for (let i = 2; i >= 0; i--) {
        const monthStr = now.clone().subtract(i, 'months').format('YYYY-MM');
        months.push(calculateMonthlyStats(events, monthStr));
      }
      setMonthHistory(months);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading sleep data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!dashboardData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>Failed to load data</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Override severity based on simulator
  const overrideSeverity = (stats: DailyStats): DailyStats => ({
    ...stats,
    totalSnoreEvents: SEVERITY_EVENTS[simulatedSeverity],
    severity: simulatedSeverity,
  });

  const getRangeStats = (): DailyStats => {
    const from = moment(dateRange.from);
    const to = moment(dateRange.to);
    const rangeEvents = dashboardData.allData.filter((e) => {
      const d = moment(e.timestamp);
      return d.isSameOrAfter(from, 'day') && d.isSameOrBefore(to, 'day');
    });
    const days = to.diff(from, 'days') + 1;
    const totalSnoreEvents = rangeEvents.length;
    const averageDuration =
      totalSnoreEvents > 0
        ? Math.round(rangeEvents.reduce((s, e) => s + e.duration, 0) / totalSnoreEvents)
        : 0;
    const interventionCount = rangeEvents.filter((e) => e.interventionTriggered).length;
    return {
      date: dateRange.to,
      totalSnoreEvents,
      averageDuration,
      interventionCount,
      peakHour: 2,
      severity: simulatedSeverity,
    };
  };

  const getDisplayStats = (): { stats: DailyStats; trend: 'improving' | 'stable' | 'worsening' } => {
    switch (activeFilter) {
      case 'today':
        return { stats: overrideSeverity(dashboardData.today), trend: 'stable' };
      case 'week': {
        const avgEvents = dashboardData.thisWeek.reduce((s, d) => s + d.totalSnoreEvents, 0) / dashboardData.thisWeek.length;
        const avgDuration = dashboardData.thisWeek.reduce((s, d) => s + d.averageDuration, 0) / dashboardData.thisWeek.length;
        return {
          stats: {
            date: moment().format('YYYY-MM-DD'),
            totalSnoreEvents: SEVERITY_EVENTS[simulatedSeverity] * 7,
            averageDuration: Math.round(avgDuration),
            interventionCount: dashboardData.thisWeek.reduce((s, d) => s + d.interventionCount, 0),
            peakHour: dashboardData.thisWeek[0].peakHour,
            severity: simulatedSeverity,
          },
          trend: calculateTrend(monthHistory.length >= 2 ? monthHistory.slice(-2) : [monthHistory[0]]),
        };
      }
      case 'month':
        return {
          stats: {
            date: moment().format('YYYY-MM-DD'),
            totalSnoreEvents: SEVERITY_EVENTS[simulatedSeverity] * 30,
            averageDuration: dashboardData.thisMonth.averageDuration,
            interventionCount: dashboardData.thisMonth.interventionCount,
            peakHour: 2,
            severity: simulatedSeverity,
          },
          trend: dashboardData.thisMonth.trend,
        };
      case 'range':
        return {
          stats: getRangeStats(),
          trend: calculateTrend(monthHistory.length >= 2 ? monthHistory.slice(-2) : [monthHistory[0]]),
        };
    }
  };

  // Build chart data based on active filter — uses real mock data, severity only affects color
  const getChartData = (): { data: DailyStats[]; title: string } => {
    switch (activeFilter) {
      case 'today':
        return { data: [dashboardData.today], title: "Today's Pattern" };
      case 'week':
        return { data: dashboardData.thisWeek, title: '7-Day Snoring Pattern' };
      case 'month': {
        const now = moment();
        const monthDays: DailyStats[] = [];
        for (let i = 29; i >= 0; i--) {
          const date = now.clone().subtract(i, 'days').format('YYYY-MM-DD');
          monthDays.push(calculateDailyStats(dashboardData.allData, date));
        }
        return { data: monthDays.filter((_, i) => i % 5 === 0 || i === 29), title: '30-Day Snoring Pattern' };
      }
      case 'range': {
        const from = moment(dateRange.from);
        const to = moment(dateRange.to);
        const days: DailyStats[] = [];
        let cur = from.clone();
        while (cur.isSameOrBefore(to, 'day')) {
          days.push(calculateDailyStats(dashboardData.allData, cur.format('YYYY-MM-DD')));
          cur.add(1, 'day');
        }
        const step = Math.max(1, Math.floor(days.length / 7));
        return {
          data: days.filter((_, i) => i % step === 0 || i === days.length - 1),
          title: `${dateRange.from} → ${dateRange.to}`,
        };
      }
    }
  };

  const { stats, trend } = getDisplayStats();
  const { data: chartData, title: chartTitle } = getChartData();
  const recommendations = getRecommendations(stats, dashboardData.thisMonth, trend);
  const severityColor = getSeverityColor(simulatedSeverity);

  const severityOptions: SimulatedSeverity[] = ['normal', 'bad', 'danger'];
  const severityLabels: Record<SimulatedSeverity, string> = {
    normal: 'Normal (0–3 events/day)',
    bad: 'Bad (4–10 events/day)',
    danger: 'Danger (11+ events/day)',
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hello, {userName} <FontAwesome5 name="hand-paper" size={20} color="#f59e0b" /></Text>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Snoring Status — </Text>
              <Text style={[styles.statusValue, { color: severityColor }]}>
                {simulatedSeverity.charAt(0).toUpperCase() + simulatedSeverity.slice(1)}
              </Text>
            </View>
            <Text style={styles.headerSubtitle}>{moment().format('dddd, MMMM D, YYYY')}</Text>
          </View>
          <View style={[styles.statusBadge, { borderColor: severityColor }]}>
            <View style={[styles.statusDot, { backgroundColor: severityColor }]} />
            <Text style={[styles.statusBadgeText, { color: severityColor }]}>
              {simulatedSeverity.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Simulator Dropdown */}
        <View style={styles.simulatorSection}>
          <Text style={styles.simulatorLabel}>Simulate Severity</Text>
          <TouchableOpacity
            style={[styles.dropdownButton, { borderColor: severityColor }]}
            onPress={() => setDropdownVisible(true)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <FontAwesome5
                name={simulatedSeverity === 'normal' ? 'check-circle' : simulatedSeverity === 'bad' ? 'exclamation-circle' : 'times-circle'}
                size={15} color={severityColor} style={{ marginRight: 8 }}
              />
              <Text style={[styles.dropdownButtonText, { color: severityColor }]}>
                {severityLabels[simulatedSeverity]}
              </Text>
            </View>
            <FontAwesome5 name="chevron-down" size={11} color="#9ca3af" />
          </TouchableOpacity>
        </View>

        <Modal transparent visible={dropdownVisible} animationType="fade" onRequestClose={() => setDropdownVisible(false)}>
          <TouchableOpacity style={styles.modalOverlay} onPress={() => setDropdownVisible(false)}>
            <View style={styles.modalMenu}>
              <Text style={styles.modalTitle}>Select Severity</Text>
              {severityOptions.map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[styles.modalOption, simulatedSeverity === opt && { backgroundColor: getSeverityColor(opt) + '22' }]}
                  onPress={() => { setSimulatedSeverity(opt); setDropdownVisible(false); }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <FontAwesome5
                      name={opt === 'normal' ? 'check-circle' : opt === 'bad' ? 'exclamation-circle' : 'times-circle'}
                      size={16} color={getSeverityColor(opt)} style={{ marginRight: 10 }}
                    />
                    <Text style={[styles.modalOptionText, { color: getSeverityColor(opt) }]}>
                      {severityLabels[opt]}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Filter */}
        <View style={styles.filterWrapper}>
          <StatsFilter
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
            dateRange={dateRange}
            onRangeChange={setDateRange}
          />
        </View>

        {/* Key Metrics */}
        <View style={styles.metricsSection}>
          <StatsCard label="Snoring Events" value={stats.totalSnoreEvents} icon="volume-up" severity={stats.severity} />
          <StatsCard label="Avg. Duration" value={stats.averageDuration} icon="clock" unit=" sec" />
          <StatsCard label="Interventions" value={stats.interventionCount} icon="wind" />
          <StatsCard label="Peak Hour" value={moment(stats.peakHour, 'H').format('hA')} icon="moon" />
        </View>

        {/* Chart */}
        <View style={styles.chartSection}>
          <SnorePatternsChart weeklyData={chartData} chartType="line" title={chartTitle} />
        </View>

        {/* Recommendations */}
        <View style={styles.recommendationSection}>
          <RecommendationCard data={recommendations} />
        </View>

        {/* Trend */}
        <View style={styles.trendSection}>
          <Text style={styles.trendLabel}>Monthly Trend</Text>
          <View style={[styles.trendBadge, {
            backgroundColor: trend === 'improving' ? '#10b98126' : trend === 'worsening' ? '#ef444426' : '#f5a52e26',
          }]}>
            <FontAwesome5 name={trend === 'improving' ? 'arrow-trend-up' : trend === 'worsening' ? 'arrow-trend-down' : 'minus'} size={13} color={trend === 'improving' ? '#10b981' : trend === 'worsening' ? '#ef4444' : '#f59e0b'} style={{ marginRight: 6 }} />
            <Text style={[styles.trendBadgeText, {
              color: trend === 'improving' ? '#10b981' : trend === 'worsening' ? '#ef4444' : '#f59e0b',
            }]}>
              {trend === 'improving' ? 'Getting better' : trend === 'worsening' ? 'Getting worse' : 'Stable'}
            </Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footerInfo}>
          <View style={styles.footerRow}>
            <FontAwesome5 name="sync-alt" size={11} color="#9ca3af" style={{ marginRight: 6, marginTop: 1 }} />
            <Text style={styles.footerText}>
              Last synced: {moment(dashboardData.allData[0]?.timestamp).fromNow()}
            </Text>
          </View>
          <Text style={styles.disclaimerText}>
            This app provides general monitoring only. For medical concerns, consult a healthcare professional.
          </Text>
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 14, color: '#9ca3af', marginTop: 12 },
  errorText: { fontSize: 16, color: '#ef4444' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12,
  },
  greeting: { fontSize: 24, fontWeight: '700', color: '#ffffff', marginBottom: 4 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  statusLabel: { fontSize: 14, color: '#9ca3af' },
  statusValue: { fontSize: 14, fontWeight: '700' },
  headerSubtitle: { fontSize: 12, color: '#6b7280' },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },
  simulatorSection: { paddingHorizontal: 20, marginBottom: 16 },
  simulatorLabel: { fontSize: 11, color: '#9ca3af', fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  dropdownButton: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#2d2d44', borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  dropdownButtonText: { fontSize: 14, fontWeight: '600' },
  dropdownArrow: { color: '#9ca3af', fontSize: 12 },
  modalOverlay: { flex: 1, backgroundColor: '#00000088', justifyContent: 'center', paddingHorizontal: 32 },
  modalMenu: { backgroundColor: '#2d2d44', borderRadius: 14, overflow: 'hidden', padding: 8 },
  modalTitle: { fontSize: 12, color: '#9ca3af', fontWeight: '600', textTransform: 'uppercase', paddingHorizontal: 12, paddingVertical: 8 },
  modalOption: { paddingHorizontal: 12, paddingVertical: 14, borderRadius: 8 },
  modalOptionText: { fontSize: 15, fontWeight: '600' },
  filterWrapper: { paddingHorizontal: 20 },
  metricsSection: { paddingHorizontal: 20, marginBottom: 20 },
  chartSection: { paddingHorizontal: 20, marginBottom: 20 },
  recommendationSection: { paddingHorizontal: 20, marginBottom: 16 },
  trendSection: { marginHorizontal: 20, marginBottom: 20 },
  trendLabel: { fontSize: 12, fontWeight: '600', color: '#9ca3af', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  trendBadge: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  trendBadgeText: { fontSize: 14, fontWeight: '600' },
  footerInfo: {
    marginHorizontal: 20, marginBottom: 20, padding: 12,
    backgroundColor: '#2d2d44', borderRadius: 8, borderLeftWidth: 3, borderLeftColor: '#3b82f6',
  },
  footerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  footerText: { fontSize: 12, color: '#9ca3af', lineHeight: 16 },
  disclaimerText: { fontSize: 11, color: '#6b7280', fontStyle: 'italic', lineHeight: 16 },
});
