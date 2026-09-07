import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import moment from 'moment';
import { DashboardData, DailyStats, MonthlyStats, UserProfile } from '../types';
import {
  calculateDailyStats,
  calculateMonthlyStats,
  calculateTrend,
  calculateInterventionEffectiveness,
  calculateDailySeverity,
} from '../utils/statsCalculator';
import { getSeverityColor, getSeverityLabel, getMoodStatus } from '../utils/recommendations';
import { StatsCard } from '../components/StatsCard';
import { SnorePatternsChart } from '../components/SnorePatternsChart';
import { StatsFilter, TimePeriod, DateRange } from '../components/StatsFilter';
import { GlassCard } from '../components/GlassCard';
import { ProfileAvatar } from '../components/ProfileAvatar';
import { calculateDashboardData } from '../services/mockBLEService';
import { bleService } from '../services/bleService';
import { scheduleDailyAdviceNotifications } from '../services/dailyAdviceNotifications';
import { useDevice } from '../context/DeviceContext';
import { FontAwesome5 } from '@expo/vector-icons';
import { colors } from '../constants/theme';

interface DashboardScreenProps {
  userName: string;
  userProfile?: UserProfile;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ userName, userProfile }) => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<TimePeriod>('week');
  const [monthHistory, setMonthHistory] = useState<MonthlyStats[]>([]);
  const [deviceStatus, setDeviceStatus] = useState({
    connected: false,
    mode: 'Connecting…',
    signal: '—',
    battery: 0,
    pairingStatus: 'Pending',
    lastSeen: '—',
  });
  const [dateRange, setDateRange] = useState<DateRange>({
    from: moment().subtract(7, 'days').format('YYYY-MM-DD'),
    to: moment().format('YYYY-MM-DD'),
  });

  const { connected, pairedDevice } = useDevice();

  useEffect(() => {
    loadData();
    return bleService.subscribeEvents((event) => {
      setDashboardData((current) =>
        calculateDashboardData([event, ...(current?.allData ?? [])]),
      );
    });
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      await bleService.restoreSession();
      if (bleService.isPaired() && !bleService.getIsConnected()) {
        try {
          await bleService.connect();
        } catch (_) {
          // Keep last synced data if reconnect fails
        }
      }
      const events = await bleService.fetchSleepEvents();
      const data = calculateDashboardData(events);
      setDashboardData(data);

      const now = moment();
      const months: MonthlyStats[] = [];
      for (let i = 2; i >= 0; i--) {
        const monthStr = now.clone().subtract(i, 'months').format('YYYY-MM');
        months.push(calculateMonthlyStats(events, monthStr));
      }
      if (months.length >= 2) {
        months[months.length - 1].trend = calculateTrend(months.slice(-2));
        months[months.length - 2].trend =
          months.length >= 3 ? calculateTrend(months.slice(0, 2)) : 'stable';
      }
      setMonthHistory(months);
      const device = bleService.getPairedDevice();
      setDeviceStatus({
        connected: bleService.getIsConnected(),
        mode: bleService.getIsConnected() ? 'Monitoring' : 'Offline',
        signal: device ? `${device.signalStrength} dBm` : '—',
        battery: 82,
        pairingStatus: device ? 'Aligned' : 'Not paired',
        lastSeen: bleService.getIsConnected() ? 'just now' : 'offline',
      });
    } catch (error) {
      console.error('Error loading data:', error);
      setDashboardData(null);
      setDeviceStatus((current) => ({
        ...current,
        connected: false,
        mode: 'Offline',
        pairingStatus: 'Disconnected',
        lastSeen: 'unavailable',
      }));
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  useEffect(() => {
    if (!dashboardData) return;
    const severity = dashboardData.today.severity;
    const trendValue = dashboardData.thisMonth.trend;
    scheduleDailyAdviceNotifications(severity, trendValue).catch(() => undefined);
  }, [dashboardData?.today.severity, dashboardData?.thisMonth.trend]);

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['top', 'left', 'right']}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#0ea5e9" />
          <Text style={styles.loadingText}>Syncing biosensor data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!dashboardData) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['top', 'left', 'right']}>
        <View style={styles.centerContent}>
          <FontAwesome5 name="unlink" size={32} color="#ef4444" style={{ marginBottom: 16 }} />
          <Text style={styles.errorText}>Could not connect to your smart pillow</Text>
          <Text style={styles.errorHint}>Check that Bluetooth is on and your pillow is powered.</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadData}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const aggregateWeekStats = (): DailyStats => {
    const week = dashboardData.thisWeek;
    const totalSnoreEvents = week.reduce((s, d) => s + d.totalSnoreEvents, 0);
    const weightedDuration = week.reduce((s, d) => s + d.averageDuration * d.totalSnoreEvents, 0);
    const averageDuration =
      totalSnoreEvents > 0 ? Math.round(weightedDuration / totalSnoreEvents) : 0;
    const interventionCount = week.reduce((s, d) => s + d.interventionCount, 0);
    const peakDay = week.reduce(
      (best, d) => (d.totalSnoreEvents > best.totalSnoreEvents ? d : best),
      week[0],
    );
    const avgDailyEvents = totalSnoreEvents / Math.max(week.length, 1);

    return {
      date: moment().format('YYYY-MM-DD'),
      totalSnoreEvents,
      averageDuration,
      interventionCount,
      peakHour: peakDay?.peakHour ?? 0,
      severity: calculateDailySeverity(avgDailyEvents, averageDuration),
    };
  };

  const getRangeStats = (): DailyStats => {
    const from = moment(dateRange.from);
    const to = moment(dateRange.to);
    const rangeEvents = dashboardData.allData.filter((e) => {
      const d = moment(e.timestamp);
      return d.isSameOrAfter(from, 'day') && d.isSameOrBefore(to, 'day');
    });
    const totalSnoreEvents = rangeEvents.length;
    const averageDuration =
      totalSnoreEvents > 0
        ? Math.round(rangeEvents.reduce((s, e) => s + e.duration, 0) / totalSnoreEvents)
        : 0;
    const interventionCount = rangeEvents.filter((e) => e.interventionTriggered).length;
    const peakHour =
      rangeEvents.length > 0
        ? rangeEvents.reduce((best, e) => {
            const hour = moment(e.timestamp).hour();
            const hourCount = rangeEvents.filter((ev) => moment(ev.timestamp).hour() === hour).length;
            const bestCount = rangeEvents.filter((ev) => moment(ev.timestamp).hour() === best).length;
            return hourCount > bestCount ? hour : best;
          }, moment(rangeEvents[0].timestamp).hour())
        : 0;
    const avgDailyEvents = totalSnoreEvents / Math.max(to.diff(from, 'days') + 1, 1);
    return {
      date: dateRange.to,
      totalSnoreEvents,
      averageDuration,
      interventionCount,
      peakHour,
      severity: calculateDailySeverity(avgDailyEvents, averageDuration),
    };
  };

  const getDisplayStats = (): {
    stats: DailyStats;
    trend: 'improving' | 'stable' | 'worsening';
  } => {
    switch (activeFilter) {
      case 'today':
        return { stats: dashboardData.today, trend: 'stable' };
      case 'week':
        return {
          stats: aggregateWeekStats(),
          trend: calculateTrend(
            monthHistory.length >= 2 ? monthHistory.slice(-2) : [monthHistory[0]],
          ),
        };
      case 'month':
        return {
          stats: {
            date: moment().format('YYYY-MM-DD'),
            totalSnoreEvents: dashboardData.thisMonth.totalSnoreEvents,
            averageDuration: dashboardData.thisMonth.averageDuration,
            interventionCount: dashboardData.thisMonth.interventionCount,
            peakHour: dashboardData.today.peakHour,
            severity: dashboardData.thisMonth.severity,
          },
          trend: dashboardData.thisMonth.trend,
        };
      case 'range':
        return {
          stats: getRangeStats(),
          trend: calculateTrend(
            monthHistory.length >= 2 ? monthHistory.slice(-2) : [monthHistory[0]],
          ),
        };
    }
  };

  const getChartData = (): { data: DailyStats[]; title: string } => {
    switch (activeFilter) {
      case 'today':
        return { data: [dashboardData.today], title: "Today's Events" };
      case 'week':
        return { data: dashboardData.thisWeek, title: '7-Day Trend' };
      case 'month': {
        const now = moment();
        const monthDays: DailyStats[] = [];
        for (let i = 29; i >= 0; i--) {
          const date = now.clone().subtract(i, 'days').format('YYYY-MM-DD');
          monthDays.push(calculateDailyStats(dashboardData.allData, date));
        }
        return {
          data: monthDays.filter((_, i) => i % 5 === 0 || i === 29),
          title: '30-Day Overview',
        };
      }
      case 'range': {
        const from = moment(dateRange.from);
        const to = moment(dateRange.to);
        const days: DailyStats[] = [];
        const cur = from.clone();
        while (cur.isSameOrBefore(to, 'day')) {
          days.push(calculateDailyStats(dashboardData.allData, cur.format('YYYY-MM-DD')));
          cur.add(1, 'day');
        }
        const step = Math.max(1, Math.floor(days.length / 7));
        return {
          data: days.filter((_, i) => i % step === 0 || i === days.length - 1),
          title: `Custom: ${dateRange.from} to ${dateRange.to}`,
        };
      }
    }
  };

  const { stats, trend } = getDisplayStats();
  const { data: chartData, title: chartTitle } = getChartData();
  const severityColor = getSeverityColor(stats.severity);
  const mood = getMoodStatus(stats.severity);
  const interventionMetrics = calculateInterventionEffectiveness(dashboardData.allData);
  const lowBattery = deviceStatus.battery <= 20;
  const activeAlerts = [
    !connected ? (pairedDevice ? 'Pillow disconnected — reconnect in Settings' : 'No pillow paired') : null,
    connected && lowBattery ? 'Low battery detected' : null,
    stats.severity === 'danger' ? 'Elevated snoring risk detected' : null,
  ].filter(Boolean) as string[];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0ea5e9" />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerGlass}>
            <View style={styles.headerContent}>
              <Text style={styles.brand}>HAGOKILLER</Text>
              <Text style={styles.greeting}>Hello, {userName}</Text>
              <View style={styles.statusRow}>
                <View style={[styles.liveDot, { backgroundColor: severityColor }]} />
                <Text style={styles.statusLabel}>Snoring Status — </Text>
                <Text style={[styles.statusValue, { color: severityColor }]}>
                  {getSeverityLabel(stats.severity)}
                </Text>
              </View>
              <Text style={styles.headerSubtitle}>
                {moment().format('dddd, MMMM D, YYYY')} ·{' '}
                {connected
                  ? `Linked to ${pairedDevice?.name || 'pillow'}`
                  : pairedDevice
                    ? 'Pillow offline'
                    : 'No device paired'}
              </Text>
            </View>
            <View style={styles.profileButton}>
              <ProfileAvatar
                name={userName}
                photoUri={userProfile?.photoUri}
                size={48}
                radius={14}
              />
            </View>
          </View>
        </View>

        {activeAlerts.length > 0 ? (
          <GlassCard style={styles.alertBanner}>
            <View style={styles.alertRow}>
              <FontAwesome5
                name="exclamation-triangle"
                size={15}
                color="#fbbf24"
                style={{ marginRight: 8, marginTop: 2 }}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.alertTitle}>System Alert</Text>
                <Text style={styles.alertText}>{activeAlerts.join(' • ')}</Text>
              </View>
            </View>
          </GlassCard>
        ) : null}

        <View style={styles.sectionPadding}>
          <Text style={styles.moodSectionLabel}>Mood status</Text>
          <GlassCard style={[styles.moodCard, { backgroundColor: mood.background, borderColor: mood.color }]}>
            <View style={[styles.moodIconWrap, { backgroundColor: `${mood.color}22` }]}>
              <FontAwesome5 name={mood.icon as any} size={22} color={mood.color} solid />
            </View>
            <View style={styles.moodCopy}>
              <Text style={[styles.moodLabel, { color: mood.color }]}>{mood.label}</Text>
              <Text style={styles.moodCaption}>{mood.caption}</Text>
              <Text style={styles.moodMeta}>
                Based on {getSeverityLabel(stats.severity).toLowerCase()} snoring status
              </Text>
            </View>
          </GlassCard>
        </View>

        <View style={styles.sectionPadding}>
          <StatsFilter
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
            dateRange={dateRange}
            onRangeChange={setDateRange}
          />
        </View>

        <View style={styles.metricsSection}>
          <StatsCard
            label="Snoring Events"
            value={stats.totalSnoreEvents}
            icon="volume-up"
            severity={stats.severity}
          />
          <StatsCard
            label="Avg. Duration"
            value={stats.averageDuration}
            icon="clock"
            unit=" sec"
          />
          <StatsCard label="Interventions" value={stats.interventionCount} icon="wind" />
          <StatsCard
            label="Peak Hour"
            value={moment(stats.peakHour, 'H').format('hA')}
            icon="moon"
          />
          <StatsCard
            label="Intervention Success"
            value={`${Math.round(interventionMetrics.successRatio * 100)}%`}
            icon="check-double"
            severity={
              interventionMetrics.trend === 'improving'
                ? 'normal'
                : interventionMetrics.trend === 'worsening'
                  ? 'danger'
                  : 'bad'
            }
          />
        </View>

        <View style={styles.sectionPadding}>
          <SnorePatternsChart weeklyData={chartData} chartType="line" title={chartTitle} />
        </View>

        <View style={styles.trendSection}>
          <Text style={styles.trendLabel}>Monthly Trend</Text>
          <GlassCard style={styles.trendCard}>
            <View
              style={[
                styles.trendSummary,
                {
                  backgroundColor:
                    trend === 'improving'
                      ? '#10b98120'
                      : trend === 'worsening'
                        ? '#ef444420'
                        : '#f59e0b20',
                },
              ]}
            >
              <FontAwesome5
                name={
                  trend === 'improving'
                    ? 'chart-line'
                    : trend === 'worsening'
                      ? 'exclamation-triangle'
                      : 'minus'
                }
                size={12}
                color={
                  trend === 'improving'
                    ? '#10b981'
                    : trend === 'worsening'
                      ? '#ef4444'
                      : '#f59e0b'
                }
                style={{ marginRight: 8 }}
              />
              <Text
                style={[
                  styles.trendSummaryText,
                  {
                    color:
                      trend === 'improving'
                        ? '#10b981'
                        : trend === 'worsening'
                          ? '#ef4444'
                          : '#f59e0b',
                  },
                ]}
              >
                {trend === 'improving'
                  ? 'Improving'
                  : trend === 'worsening'
                    ? 'Worsening'
                    : 'Stable'}
              </Text>
            </View>
            {monthHistory.map((m, index) => {
              const mColor = getSeverityColor(m.severity);
              const prev = index > 0 ? monthHistory[index - 1] : null;
              const change = prev ? m.totalSnoreEvents - prev.totalSnoreEvents : 0;
              return (
                <View key={m.month} style={styles.monthRow}>
                  <View style={styles.monthLeft}>
                    <Text style={styles.monthName}>{moment(m.month, 'YYYY-MM').format('MMMM YYYY')}</Text>
                    <View style={styles.monthSeverityBadge}>
                      <View style={[styles.monthDot, { backgroundColor: mColor }]} />
                      <Text style={[styles.monthSeverityText, { color: mColor }]}>
                        {m.severity.charAt(0).toUpperCase() + m.severity.slice(1)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.monthRight}>
                    <Text style={styles.monthEvents}>{m.totalSnoreEvents} events</Text>
                    {prev ? (
                      <View style={styles.monthChange}>
                        <FontAwesome5
                          name={change < 0 ? 'arrow-down' : change > 0 ? 'arrow-up' : 'minus'}
                          size={10}
                          color={change < 0 ? '#10b981' : change > 0 ? '#ef4444' : '#f59e0b'}
                          style={{ marginRight: 4 }}
                        />
                        <Text
                          style={[
                            styles.monthChangeText,
                            {
                              color:
                                change < 0 ? '#10b981' : change > 0 ? '#ef4444' : '#f59e0b',
                            },
                          ]}
                        >
                          {Math.abs(change)}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </GlassCard>
        </View>

        <View style={styles.footerContainer}>
          <FontAwesome5 name="sync" size={10} color="#6b7280" style={{ marginRight: 6 }} />
          <Text style={styles.footerText}>
            System synced:{' '}
            {dashboardData.allData[0]?.timestamp
              ? moment(dashboardData.allData[0].timestamp).fromNow()
              : '—'}
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerContent: { alignItems: 'center' },
  loadingText: {
    fontSize: 14,
    color: '#0ea5e9',
    marginTop: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  errorHint: {
    fontSize: 13,
    color: '#333333',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 24,
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: '#0ea5e9',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 14,
  },
  retryButtonText: { color: '#ffffff', fontWeight: '700', fontSize: 15 },

  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  headerGlass: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  headerContent: { flex: 1, paddingRight: 12 },
  brand: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
    marginBottom: 4,
  },
  greeting: { fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: 6 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  liveDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  statusLabel: { fontSize: 13, color: colors.textMuted },
  statusValue: { fontSize: 13, fontWeight: '700' },
  headerSubtitle: { fontSize: 12, color: colors.textMuted },
  profileButton: { alignItems: 'center', justifyContent: 'center' },

  alertBanner: { marginHorizontal: 16, marginBottom: 12, padding: 14 },
  alertRow: { flexDirection: 'row', alignItems: 'flex-start' },
  alertTitle: { fontSize: 12, fontWeight: '700', color: '#b45309', marginBottom: 2 },
  alertText: { fontSize: 12, color: '#92400e', lineHeight: 18 },

  sectionPadding: { paddingHorizontal: 16, marginBottom: 8 },
  moodSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  moodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1.5,
    marginBottom: 8,
  },
  moodIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  moodCopy: { flex: 1 },
  moodLabel: { fontSize: 22, fontWeight: '800', marginBottom: 4 },
  moodCaption: { fontSize: 13, color: colors.textSecondary, lineHeight: 18, marginBottom: 4 },
  moodMeta: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },

  metricsSection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    marginBottom: 12,
  },

  trendSection: { marginHorizontal: 16, marginBottom: 20 },
  trendLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  trendCard: { overflow: 'hidden' },
  trendSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  trendSummaryText: { fontSize: 13, fontWeight: '700' },
  monthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  monthLeft: { flex: 1 },
  monthName: { fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 4 },
  monthSeverityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  monthDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  monthSeverityText: { fontSize: 11, fontWeight: '700' },
  monthRight: { alignItems: 'flex-end' },
  monthEvents: { fontSize: 22, fontWeight: '800', color: colors.text },
  monthEventsLabel: { fontSize: 10, color: colors.textMuted, marginTop: -2 },
  monthChange: { flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: 3 },
  monthChangeText: { fontSize: 11, fontWeight: '700' },

  recommendationSection: { paddingHorizontal: 16, marginBottom: 16 },
  adviceHint: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 17,
    marginBottom: 10,
  },
  logsSection: { paddingHorizontal: 16, marginBottom: 20 },
  logsCard: { padding: 16 },
  sectionHeader: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 6 },
  settingDescription: { fontSize: 12, color: colors.textMuted, marginBottom: 4, lineHeight: 18 },
  logsHeader: {
    marginBottom: 14,
  },
  sortRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  sortLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '600', marginRight: 4 },
  sortOption: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.backgroundMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sortOptionActive: {
    backgroundColor: colors.accentSoft,
    borderColor: 'rgba(14, 165, 233,0.35)',
  },
  sortOptionText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  sortOptionTextActive: { color: colors.accent },
  emptyLogsRow: { paddingVertical: 20 },
  emptyLogsText: { fontSize: 13, color: colors.textMuted },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  logIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  logContent: { flex: 1, paddingRight: 8 },
  logTimestamp: { color: colors.text, fontSize: 13, fontWeight: '700', marginBottom: 2 },
  logDetails: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  logRight: { alignItems: 'flex-end' },
  severityPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 6,
  },
  severityText: { fontSize: 11, fontWeight: '800' },
  logDuration: { color: colors.textSecondary, fontSize: 13, fontWeight: '700' },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  paginationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.accent,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  paginationButtonDisabled: { opacity: 0.35 },
  paginationButtonText: { color: colors.onAccent, fontSize: 12, fontWeight: '700' },
  paginationLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },

  footerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  footerText: { fontSize: 11, color: '#333333', fontStyle: 'italic' },
});
