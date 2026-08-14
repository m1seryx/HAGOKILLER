import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import moment from 'moment';
import { DashboardData, DailyStats, MonthlyStats, SleepEvent, UserProfile } from '../types';
import {
  calculateDailyStats,
  calculateMonthlyStats,
  calculateTrend,
  calculateInterventionEffectiveness,
  calculateDailySeverity,
} from '../utils/statsCalculator';
import { getRecommendations, getSeverityColor, getSeverityLabel } from '../utils/recommendations';
import { StatsCard } from '../components/StatsCard';
import { SnorePatternsChart } from '../components/SnorePatternsChart';
import { RecommendationCard } from '../components/RecommendationCard';
import { StatsFilter, TimePeriod, DateRange } from '../components/StatsFilter';
import { GlassCard } from '../components/GlassCard';
import { ProfileAvatar } from '../components/ProfileAvatar';
import { calculateDashboardData } from '../services/mockBLEService';
import { bleService } from '../services/bleService';
import { useDevice } from '../context/DeviceContext';
import { FontAwesome5 } from '@expo/vector-icons';

interface DashboardScreenProps {
  userName: string;
  userProfile?: UserProfile;
}

const LOGS_PER_PAGE = 10;
const TAB_ORDER = ['analytics', 'recommendations', 'logs'] as const;
type DashboardTab = (typeof TAB_ORDER)[number];

const getLogSeverityStyle = (severity: string) => {
  switch (severity) {
    case 'high':
      return { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.14)', label: 'High' };
    case 'medium':
      return { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.14)', label: 'Medium' };
    default:
      return { color: '#10b981', bg: 'rgba(16, 185, 129, 0.14)', label: 'Low' };
  }
};

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ userName, userProfile }) => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<TimePeriod>('week');
  const [monthHistory, setMonthHistory] = useState<MonthlyStats[]>([]);
  const [activeTab, setActiveTab] = useState<DashboardTab>('analytics');
  const [eventLogs, setEventLogs] = useState<SleepEvent[]>([]);
  const [sortOption, setSortOption] = useState<'date' | 'severity' | 'duration'>('date');
  const [logsPage, setLogsPage] = useState(0);
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
  const activeTabRef = useRef<DashboardTab>(activeTab);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    loadData();
    return bleService.subscribeEvents((event) => {
      setEventLogs((current) => [event, ...current]);
      setDashboardData((current) =>
        calculateDashboardData([event, ...(current?.allData ?? [])]),
      );
    });
  }, []);

  useEffect(() => {
    setLogsPage(0);
  }, [sortOption, dateRange.from, dateRange.to, activeFilter]);

  const switchTab = (nextTab: DashboardTab) => {
    if (nextTab === activeTabRef.current) return;
    setActiveTab(nextTab);
    activeTabRef.current = nextTab;
  };

  const goToAdjacentTab = (direction: 1 | -1) => {
    const index = TAB_ORDER.indexOf(activeTabRef.current);
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= TAB_ORDER.length) return;
    switchTab(TAB_ORDER[nextIndex]);
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > 24 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.4,
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dx <= -50) goToAdjacentTab(1);
          else if (gesture.dx >= 50) goToAdjacentTab(-1);
        },
      }),
    [],
  );

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
      setEventLogs(events);
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

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['top', 'left', 'right']}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#6366f1" />
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

  const getFilteredAndSortedLogs = (): SleepEvent[] => {
    const from = moment(dateRange.from);
    const to = moment(dateRange.to);
    const severityRank: Record<SleepEvent['severity'], number> = { low: 1, medium: 2, high: 3 };

    return [...eventLogs]
      .filter((event) => {
        const eventDate = moment(event.timestamp);
        return eventDate.isSameOrAfter(from, 'day') && eventDate.isSameOrBefore(to, 'day');
      })
      .sort((a, b) => {
        if (sortOption === 'duration') return b.duration - a.duration;
        if (sortOption === 'severity') return severityRank[b.severity] - severityRank[a.severity];
        return b.timestamp - a.timestamp;
      });
  };

  const visibleLogs = getFilteredAndSortedLogs();
  const logCount = visibleLogs.length;
  const totalLogPages = Math.max(1, Math.ceil(logCount / LOGS_PER_PAGE));
  const currentLogsPage = Math.min(logsPage, totalLogPages - 1);
  const paginatedLogs = visibleLogs.slice(
    currentLogsPage * LOGS_PER_PAGE,
    currentLogsPage * LOGS_PER_PAGE + LOGS_PER_PAGE,
  );
  const logRangeStart = logCount === 0 ? 0 : currentLogsPage * LOGS_PER_PAGE + 1;
  const logRangeEnd = Math.min(logCount, (currentLogsPage + 1) * LOGS_PER_PAGE);

  const { stats, trend } = getDisplayStats();
  const { data: chartData, title: chartTitle } = getChartData();
  const recommendations = getRecommendations(stats, dashboardData.thisMonth, trend);
  const severityColor = getSeverityColor(stats.severity);
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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />
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
          <StatsFilter
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
            dateRange={dateRange}
            onRangeChange={setDateRange}
          />
        </View>

        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'analytics' && styles.tabButtonActive]}
            onPress={() => switchTab('analytics')}
            activeOpacity={0.8}
          >
            <FontAwesome5
              name="chart-pie"
              size={13}
              color={activeTab === 'analytics' ? '#ffffff' : '#6b7280'}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.tabText, activeTab === 'analytics' && styles.tabTextActive]}>
              Analytics
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'recommendations' && styles.tabButtonActive]}
            onPress={() => switchTab('recommendations')}
            activeOpacity={0.8}
          >
            <FontAwesome5
              name="stethoscope"
              size={13}
              color={activeTab === 'recommendations' ? '#ffffff' : '#6b7280'}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[styles.tabText, activeTab === 'recommendations' && styles.tabTextActive]}
            >
              Assessment
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'logs' && styles.tabButtonActive]}
            onPress={() => switchTab('logs')}
            activeOpacity={0.8}
          >
            <FontAwesome5
              name="clipboard-list"
              size={13}
              color={activeTab === 'logs' ? '#ffffff' : '#6b7280'}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.tabText, activeTab === 'logs' && styles.tabTextActive]}>Logs</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.swipeHint}>Swipe left or right to switch tabs</Text>

        <View {...panResponder.panHandlers}>
          {activeTab === 'analytics' ? (
            <>
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
                            : 'equals'
                      }
                      size={14}
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
                        ? 'Improving over time'
                        : trend === 'worsening'
                          ? 'Worsening over time'
                          : 'Stable pattern'}
                    </Text>
                  </View>

                  {monthHistory.map((m, i) => {
                    const prev = monthHistory[i - 1];
                    const change = prev ? m.totalSnoreEvents - prev.totalSnoreEvents : null;
                    const mColor = getSeverityColor(m.severity);
                    return (
                      <View key={m.month} style={styles.monthRow}>
                        <View style={styles.monthLeft}>
                          <Text style={styles.monthName}>
                            {moment(m.month, 'YYYY-MM').format('MMMM YYYY')}
                          </Text>
                          <View style={[styles.monthSeverityBadge, { backgroundColor: mColor + '22' }]}>
                            <View style={[styles.monthDot, { backgroundColor: mColor }]} />
                            <Text style={[styles.monthSeverityText, { color: mColor }]}>
                              {m.severity.charAt(0).toUpperCase() + m.severity.slice(1)}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.monthRight}>
                          <Text style={styles.monthEvents}>{m.totalSnoreEvents}</Text>
                          <Text style={styles.monthEventsLabel}>events</Text>
                          {change !== null && (
                            <View style={styles.monthChange}>
                              <FontAwesome5
                                name={change < 0 ? 'arrow-down' : change > 0 ? 'arrow-up' : 'minus'}
                                size={10}
                                color={change < 0 ? '#10b981' : change > 0 ? '#ef4444' : '#f59e0b'}
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
                          )}
                        </View>
                      </View>
                    );
                  })}
                </GlassCard>
              </View>
            </>
          ) : activeTab === 'recommendations' ? (
            <View style={styles.recommendationSection}>
              <RecommendationCard data={recommendations} />
            </View>
          ) : (
            <View style={styles.logsSection}>
              <GlassCard style={styles.logsCard}>
                <View style={styles.logsHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sectionHeader}>Sleep Event Logs</Text>
                    <Text style={styles.settingDescription}>
                      {logCount === 0
                        ? 'No events for selected range'
                        : `Showing ${logRangeStart}–${logRangeEnd} of ${logCount}`}
                    </Text>
                  </View>
                </View>

                <View style={styles.sortRow}>
                  <Text style={styles.sortLabel}>Sort by</Text>
                  {(['date', 'severity', 'duration'] as const).map((option) => (
                    <TouchableOpacity
                      key={option}
                      style={[styles.sortOption, sortOption === option && styles.sortOptionActive]}
                      onPress={() => setSortOption(option)}
                    >
                      <Text
                        style={[
                          styles.sortOptionText,
                          sortOption === option && styles.sortOptionTextActive,
                        ]}
                      >
                        {option === 'date' ? 'Date' : option === 'severity' ? 'Severity' : 'Duration'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {visibleLogs.length === 0 ? (
                  <View style={styles.emptyLogsRow}>
                    <Text style={styles.emptyLogsText}>
                      No sleep events available for the selected range.
                    </Text>
                  </View>
                ) : (
                  <>
                    {paginatedLogs.map((entry) => {
                      const sev = getLogSeverityStyle(entry.severity);
                      const inflated = entry.interventionTriggered;
                      return (
                        <View key={entry.id} style={styles.logRow}>
                          <View
                            style={[
                              styles.logIconWrap,
                              { backgroundColor: inflated ? 'rgba(99,102,241,0.16)' : sev.bg },
                            ]}
                          >
                            <FontAwesome5
                              name={inflated ? 'wind' : 'wave-square'}
                              size={13}
                              color={inflated ? '#818cf8' : sev.color}
                            />
                          </View>
                          <View style={styles.logContent}>
                            <Text style={styles.logTimestamp}>
                              {inflated ? 'Pillow inflated' : 'Snore detected'}
                            </Text>
                            <Text style={styles.logDetails}>
                              {moment(entry.timestamp).format('MMM D · h:mm A')}
                            </Text>
                          </View>
                          <View style={styles.logRight}>
                            <View style={[styles.severityPill, { backgroundColor: sev.bg }]}>
                              <Text style={[styles.severityText, { color: sev.color }]}>{sev.label}</Text>
                            </View>
                            <Text style={styles.logDuration}>{entry.duration}s</Text>
                          </View>
                        </View>
                      );
                    })}

                    {totalLogPages > 1 ? (
                      <View style={styles.paginationRow}>
                        <TouchableOpacity
                          style={[
                            styles.paginationButton,
                            currentLogsPage === 0 && styles.paginationButtonDisabled,
                          ]}
                          onPress={() => setLogsPage((page) => Math.max(0, page - 1))}
                          disabled={currentLogsPage === 0}
                        >
                          <FontAwesome5 name="chevron-left" size={12} color="#ffffff" />
                          <Text style={styles.paginationButtonText}>Previous</Text>
                        </TouchableOpacity>
                        <Text style={styles.paginationLabel}>
                          Page {currentLogsPage + 1} of {totalLogPages}
                        </Text>
                        <TouchableOpacity
                          style={[
                            styles.paginationButton,
                            currentLogsPage >= totalLogPages - 1 && styles.paginationButtonDisabled,
                          ]}
                          onPress={() =>
                            setLogsPage((page) => Math.min(totalLogPages - 1, page + 1))
                          }
                          disabled={currentLogsPage >= totalLogPages - 1}
                        >
                          <Text style={styles.paginationButtonText}>Next</Text>
                          <FontAwesome5 name="chevron-right" size={12} color="#ffffff" />
                        </TouchableOpacity>
                      </View>
                    ) : null}
                  </>
                )}
              </GlassCard>
            </View>
          )}
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
  container: { flex: 1, backgroundColor: '#0a0b10' },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0a0b10',
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerContent: { alignItems: 'center' },
  loadingText: {
    fontSize: 14,
    color: '#6366f1',
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
    color: '#9ca3af',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 24,
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 14,
  },
  retryButtonText: { color: '#ffffff', fontWeight: '700', fontSize: 15 },

  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  headerGlass: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  headerContent: { flex: 1, paddingRight: 12 },
  brand: {
    color: '#818cf8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
    marginBottom: 4,
  },
  greeting: { fontSize: 24, fontWeight: '800', color: '#ffffff', marginBottom: 6 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  liveDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  statusLabel: { fontSize: 13, color: '#9ca3af' },
  statusValue: { fontSize: 13, fontWeight: '700' },
  headerSubtitle: { fontSize: 12, color: '#6b7280' },
  profileButton: { alignItems: 'center', justifyContent: 'center' },

  alertBanner: { marginHorizontal: 16, marginBottom: 12, padding: 14 },
  alertRow: { flexDirection: 'row', alignItems: 'flex-start' },
  alertTitle: { fontSize: 12, fontWeight: '700', color: '#fbbf24', marginBottom: 2 },
  alertText: { fontSize: 12, color: '#fde68a', lineHeight: 18 },

  sectionPadding: { paddingHorizontal: 16, marginBottom: 8 },
  swipeHint: {
    textAlign: 'center',
    color: '#64748b',
    fontSize: 11,
    marginBottom: 10,
    fontWeight: '500',
  },

  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
  },
  tabButtonActive: { backgroundColor: 'rgba(99, 102, 241, 0.28)' },
  tabText: { fontSize: 12, fontWeight: '600', color: '#6b7280' },
  tabTextActive: { color: '#ffffff', fontWeight: '700' },

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
    color: '#9ca3af',
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
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  trendSummaryText: { fontSize: 13, fontWeight: '700' },
  monthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  monthLeft: { flex: 1 },
  monthName: { fontSize: 14, fontWeight: '600', color: '#e5e7eb', marginBottom: 4 },
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
  monthEvents: { fontSize: 22, fontWeight: '800', color: '#ffffff' },
  monthEventsLabel: { fontSize: 10, color: '#6b7280', marginTop: -2 },
  monthChange: { flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: 3 },
  monthChangeText: { fontSize: 11, fontWeight: '700' },

  recommendationSection: { paddingHorizontal: 16, marginBottom: 16 },
  logsSection: { paddingHorizontal: 16, marginBottom: 20 },
  logsCard: { padding: 16 },
  sectionHeader: { fontSize: 16, fontWeight: '700', color: '#ffffff', marginBottom: 6 },
  settingDescription: { fontSize: 12, color: '#9ca3af', marginBottom: 4, lineHeight: 18 },
  logsHeader: {
    marginBottom: 14,
  },
  sortRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  sortLabel: { color: '#9ca3af', fontSize: 12, fontWeight: '600', marginRight: 4 },
  sortOption: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sortOptionActive: {
    backgroundColor: 'rgba(99,102,241,0.2)',
    borderColor: 'rgba(99,102,241,0.4)',
  },
  sortOptionText: { color: '#9ca3af', fontSize: 12, fontWeight: '600' },
  sortOptionTextActive: { color: '#ffffff' },
  emptyLogsRow: { paddingVertical: 20 },
  emptyLogsText: { fontSize: 13, color: '#9ca3af' },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
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
  logTimestamp: { color: '#f8fafc', fontSize: 13, fontWeight: '700', marginBottom: 2 },
  logDetails: { color: '#94a3b8', fontSize: 12, lineHeight: 17 },
  logRight: { alignItems: 'flex-end' },
  severityPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 6,
  },
  severityText: { fontSize: 11, fontWeight: '800' },
  logDuration: { color: '#e5e7eb', fontSize: 13, fontWeight: '700' },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
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
  paginationButtonDisabled: { opacity: 0.35 },
  paginationButtonText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  paginationLabel: { color: '#9ca3af', fontSize: 12, fontWeight: '600' },

  footerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  footerText: { fontSize: 11, color: '#6b7280', fontStyle: 'italic' },
});
